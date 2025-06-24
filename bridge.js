const express = require('express');
const WebSocket = require('ws');
const twilio = require('twilio');
const sqlite3 = require('sqlite3').verbose();
const { createReadStream, createWriteStream, writeFileSync } = require('fs');
const { promisify } = require('util');
const crypto = require('crypto');

// Audio processing
const soxr = require('soxr'); // npm install soxr for resampling
const mulaw = require('mulaw-pcm'); // npm install mulaw-pcm for μ-law conversion
const { Readable, Transform } = require('stream');

class TwilioOpenAIBridge {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.db = new sqlite3.Database('./calls.db');
    this.activeSessions = new Map();
    this.twilioConnections = new Map(); // callSid -> WebSocket
    this.twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
    
    this.setupDatabase();
    this.setupRoutes();
  }

  setupDatabase() {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS calls (
          call_sid TEXT PRIMARY KEY,
          stream_sid TEXT,
          ai_session_id TEXT,
          status TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          duration INTEGER,
          transcript TEXT,
          recording_url TEXT
        )
      `);
      
      this.db.run(`
        CREATE TABLE IF NOT EXISTS transcript_turns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          call_sid TEXT,
          turn_number INTEGER,
          speaker TEXT, -- 'user' or 'assistant'
          content TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          audio_blob BLOB,
          FOREIGN KEY (call_sid) REFERENCES calls (call_sid)
        )
      `);
    });
  }

  setupRoutes() {
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());

    // Twilio webhook for incoming calls
    this.app.post('/webhook/voice', (req, res) => {
      const { CallSid, From, To } = req.body;
      
      // Insert call record
      this.db.run(
        'INSERT INTO calls (call_sid, status) VALUES (?, ?)',
        [CallSid, 'answered']
      );

      const twiml = new twilio.twiml.VoiceResponse();
      
      if (this.config.mode === 'precanned') {
        // Mode 1: Pre-canned script
        twiml.play(`${this.config.baseUrl}/audio/${this.config.scriptId}.wav`);
        twiml.hangup();
      } else {
        // Mode 2: Live AI conversation
        const start = twiml.start();
        start.stream({
          url: `wss://${this.config.domain}/websocket/${CallSid}`,
          track: 'both_tracks'
        });
        
        // Add some random jitter to avoid detection
        const jitter = Math.random() * 100 + 50; // 50-150ms
        setTimeout(() => {
          twiml.dial(this.config.targetNumber);
        }, jitter);
      }

      res.type('text/xml');
      res.send(twiml.toString());
    });

    // WebSocket endpoint for media streaming
    const wss = new WebSocket.Server({ 
      port: this.config.wsPort,
      path: '/websocket'
    });

    wss.on('connection', (ws, req) => {
      const callSid = req.url.split('/').pop();
      this.handleMediaStream(ws, callSid);
    });

    // Call status webhooks
    this.app.post('/webhook/status', (req, res) => {
      const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;
      
      this.db.run(
        'UPDATE calls SET status = ?, completed_at = CURRENT_TIMESTAMP, duration = ?, recording_url = ? WHERE call_sid = ?',
        [CallStatus, CallDuration, RecordingUrl, CallSid]
      );

      // Cleanup active session
      if (this.activeSessions.has(CallSid)) {
        const session = this.activeSessions.get(CallSid);
        if (session.openaiWs) {
          session.openaiWs.close();
        }
        this.activeSessions.delete(CallSid);
      }

      res.sendStatus(200);
    });

    // CLI endpoint to initiate calls
    this.app.post('/calls', async (req, res) => {
      const { to, issue, script } = req.body;
      
      try {
        const call = await this.twilioClient.calls.create({
          url: `${this.config.baseUrl}/webhook/voice`,
          to: to,
          from: this.config.twilio.phoneNumber,
          statusCallback: `${this.config.baseUrl}/webhook/status`,
          statusCallbackEvent: ['completed'],
          statusCallbackMethod: 'POST'
        });

        res.json({ callSid: call.sid, status: 'initiated' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async handleMediaStream(ws, callSid) {
    const session = {
      callSid,
      streamSid: null,
      openaiWs: null,
      turnNumber: 0,
      currentTranscript: '',
      silenceTimer: null,
      lastAudioTime: Date.now(),
      vadBuffer: []
    };

    this.activeSessions.set(callSid, session);
    this.twilioConnections.set(callSid, ws);

    // Connect to OpenAI Realtime
    await this.initOpenAISession(session);

    ws.on('message', async (message) => {
      try {
        const msg = JSON.parse(message);
        
        switch (msg.event) {
          case 'start':
            session.streamSid = msg.start.streamSid;
            this.db.run(
              'UPDATE calls SET stream_sid = ? WHERE call_sid = ?',
              [session.streamSid, callSid]
            );
            break;

          case 'media':
            if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
              await this.processIncomingAudio(session, msg.media);
            } else {
              console.warn('OpenAI WebSocket not ready, attempting reconnection');
              await this.initOpenAISession(session);
            }
            break;

          case 'stop':
            this.cleanup(session);
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      this.twilioConnections.delete(callSid);
      this.cleanup(session);
    });

    ws.on('error', (error) => {
      console.error('Twilio WebSocket error:', error);
      this.twilioConnections.delete(callSid);
      this.cleanup(session);
    });
  }

  async initOpenAISession(session, retryCount = 0) {
    const maxRetries = 3;
    const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
    
    try {
      session.openaiWs = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.openai.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      session.aiSessionId = crypto.randomUUID();
      
      session.openaiWs.on('open', () => {
      // Configure session
      session.openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: this.config.aiInstructions,
          voice: 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      }));

      this.db.run(
        'UPDATE calls SET ai_session_id = ? WHERE call_sid = ?',
        [session.aiSessionId, session.callSid]
      );
    });

    session.openaiWs.on('message', (data) => {
      this.handleOpenAIMessage(session, JSON.parse(data));
    });

    session.openaiWs.on('error', async (error) => {
      console.error('OpenAI WebSocket error:', error);
      
      if (retryCount < maxRetries) {
        console.log(`Retrying OpenAI connection (${retryCount + 1}/${maxRetries})`);
        await this.delay(1000 * Math.pow(2, retryCount)); // Exponential backoff
        await this.initOpenAISession(session, retryCount + 1);
      } else {
        console.error('Max retries reached for OpenAI connection');
        this.cleanup(session);
      }
    });

      // Auto-reconnect every 9 minutes to avoid 10-minute timeout
      session.reconnectTimer = setTimeout(() => {
        this.reconnectOpenAI(session);
      }, 540000); // 9 minutes
    } catch (error) {
      console.error('Failed to initialize OpenAI session:', error);
      if (retryCount < maxRetries) {
        console.log(`Retrying OpenAI connection (${retryCount + 1}/${maxRetries})`);
        await this.delay(1000 * Math.pow(2, retryCount));
        await this.initOpenAISession(session, retryCount + 1);
      } else {
        console.error('Max retries reached for OpenAI connection');
        this.cleanup(session);
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async reconnectOpenAI(session) {
    if (session.openaiWs) {
      session.openaiWs.close();
    }
    
    clearTimeout(session.reconnectTimer);
    await this.initOpenAISession(session);
  }

  async processIncomingAudio(session, media) {
    try {
      // Convert Twilio's base64 μ-law to PCM
      const audioBuffer = Buffer.from(media.payload, 'base64');
      
      // Resample from 8kHz μ-law to 16kHz PCM
      const pcmBuffer = await this.convertMuLawToPCM(audioBuffer);
      
      // Voice activity detection
      const hasVoice = this.detectVoiceActivity(pcmBuffer);
      
      if (hasVoice) {
        session.lastAudioTime = Date.now();
        
        // Send to OpenAI
        session.openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: pcmBuffer.toString('base64')
        }));
      }

      // Check for silence to commit audio
      if (Date.now() - session.lastAudioTime > 300) {
        session.openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.commit'
        }));
      }
    } catch (error) {
      console.error('Audio processing error:', error);
    }
  }

  async handleOpenAIMessage(session, message) {
    switch (message.type) {
      case 'response.audio.delta':
        if (message.delta) {
          await this.sendAudioToTwilio(session, message.delta);
        }
        break;

      case 'conversation.item.created':
        if (message.item.type === 'message') {
          this.saveTranscriptTurn(session, message.item);
        }
        break;

      case 'response.done':
        session.turnNumber++;
        break;

      case 'error':
        console.error('OpenAI error:', message.error);
        break;
    }
  }

  async sendAudioToTwilio(session, audioBase64) {
    try {
      // Convert PCM to μ-law for Twilio
      const pcmBuffer = Buffer.from(audioBase64, 'base64');
      const muLawBuffer = await this.convertPCMToMuLaw(pcmBuffer);
      
      // Find active Twilio WebSocket connection
      const twilioWs = this.findTwilioConnection(session.callSid);
      if (twilioWs && twilioWs.readyState === WebSocket.OPEN) {
        const mediaMessage = {
          event: 'media',
          streamSid: session.streamSid,
          media: {
            payload: muLawBuffer.toString('base64')
          }
        };
        
        twilioWs.send(JSON.stringify(mediaMessage));
      } else {
        console.warn('Twilio WebSocket not available or not ready');
      }
    } catch (error) {
      console.error('Error sending audio to Twilio:', error);
    }
  }

  async convertMuLawToPCM(muLawBuffer) {
    try {
      // First convert μ-law to PCM (8kHz)
      const pcm8khz = mulaw.decode(muLawBuffer);
      
      // Then resample from 8kHz to 16kHz
      return new Promise((resolve, reject) => {
        const resampler = soxr({
          inputRate: 8000,
          outputRate: 16000,
          inputType: soxr.INT16,
          outputType: soxr.INT16
        });

        let output = Buffer.alloc(0);
        
        resampler.on('data', (chunk) => {
          output = Buffer.concat([output, chunk]);
        });
        
        resampler.on('end', () => resolve(output));
        resampler.on('error', reject);
        
        resampler.write(pcm8khz);
        resampler.end();
      });
    } catch (error) {
      console.error('μ-law to PCM conversion error:', error);
      throw error;
    }
  }

  async convertPCMToMuLaw(pcmBuffer) {
    try {
      // First resample from 16kHz to 8kHz
      const pcm8khz = await new Promise((resolve, reject) => {
        const resampler = soxr({
          inputRate: 16000,
          outputRate: 8000,
          inputType: soxr.INT16,
          outputType: soxr.INT16
        });

        let output = Buffer.alloc(0);
        
        resampler.on('data', (chunk) => {
          output = Buffer.concat([output, chunk]);
        });
        
        resampler.on('end', () => resolve(output));
        resampler.on('error', reject);
        
        resampler.write(pcmBuffer);
        resampler.end();
      });
      
      // Then encode PCM to μ-law
      return mulaw.encode(pcm8khz);
    } catch (error) {
      console.error('PCM to μ-law conversion error:', error);
      throw error;
    }
  }

  detectVoiceActivity(audioBuffer) {
    // Simple energy-based VAD
    let energy = 0;
    const samples = new Int16Array(audioBuffer.buffer);
    
    for (let i = 0; i < samples.length; i++) {
      energy += samples[i] * samples[i];
    }
    
    const avgEnergy = energy / samples.length;
    return avgEnergy > 1000000; // Adjust threshold as needed
  }

  saveTranscriptTurn(session, item) {
    const content = item.content?.[0]?.transcript || item.content?.[0]?.text || '';
    const speaker = item.role;
    
    this.db.run(
      'INSERT INTO transcript_turns (call_sid, turn_number, speaker, content) VALUES (?, ?, ?, ?)',
      [session.callSid, session.turnNumber, speaker, content]
    );

    // Update call transcript summary
    session.currentTranscript += `${speaker}: ${content}\n`;
    this.db.run(
      'UPDATE calls SET transcript = ? WHERE call_sid = ?',
      [session.currentTranscript, session.callSid]
    );
  }

  findTwilioConnection(callSid) {
    const connection = this.twilioConnections.get(callSid);
    if (connection && connection.readyState === WebSocket.OPEN) {
      return connection;
    }
    return null;
  }

  cleanup(session) {
    if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
      session.openaiWs.close();
    }
    
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
    }
    
    this.twilioConnections.delete(session.callSid);
    this.activeSessions.delete(session.callSid);
  }

  async generatePreCannedAudio(script, outputPath) {
    // Generate TTS audio file for pre-canned mode
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.openai.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'alloy',
        input: script,
        response_format: 'wav'
      })
    });

    const audioBuffer = await response.arrayBuffer();
    writeFileSync(outputPath, Buffer.from(audioBuffer));
    
    return outputPath;
  }

  start() {
    this.app.listen(this.config.port, () => {
      console.log(`Twilio-OpenAI bridge running on port ${this.config.port}`);
    });
  }
}

// Configuration
const config = {
  port: process.env.PORT || 3000,
  wsPort: process.env.WS_PORT || 3001,
  domain: process.env.DOMAIN || 'localhost:3000',
  baseUrl: process.env.BASE_URL || 'https://your-domain.com',
  mode: process.env.MODE || 'live', // 'precanned' or 'live'
  
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  
  targetNumber: process.env.TARGET_NUMBER,
  
  aiInstructions: `You are an AI assistant making calls on behalf of a citizen to discuss political issues. 
  Be polite, concise, and professional. State your purpose clearly and present your argument respectfully. 
  If asked, explain that you are an AI assistant helping to facilitate citizen engagement.`,
  
  scriptId: 'default'
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'call-senator') {
    const issueIndex = args.indexOf('--issue');
    const issue = issueIndex > -1 ? args[issueIndex + 1] : 'general concerns';
    
    const bridge = new TwilioOpenAIBridge(config);
    
    // Make the call
    fetch(`${config.baseUrl}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: config.targetNumber,
        issue: issue
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log(`Call initiated: ${data.callSid}`);
      console.log(`Issue: ${issue}`);
    })
    .catch(err => console.error('Call failed:', err));
  } else {
    // Start the bridge service
    const bridge = new TwilioOpenAIBridge(config);
    bridge.start();
  }
}

module.exports = TwilioOpenAIBridge;
