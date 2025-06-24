 
# Twilio-OpenAI Voice Bridge

A Node.js service that bridges Twilio voice calls with OpenAI's Realtime API for AI-powered phone conversations.

## Features

- **Two modes**: Pre-canned TTS playback or live AI conversations
- **Real-time audio processing**: Converts between Twilio's μ-law and OpenAI's PCM formats
- **Auto-reconnection**: Handles OpenAI's 10-minute session limits
- **Call logging**: SQLite database with full transcripts and audio blobs
- **CLI interface**: Simple command-line tools for making calls
- **Voice activity detection**: Smart silence detection for natural conversations

## Quick Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment** (copy `.env.example` to `.env`):
```bash
# Twilio credentials
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI API key
OPENAI_API_KEY=sk-your-api-key

# Server configuration
PORT=3000
WS_PORT=3001
DOMAIN=your-domain.com
BASE_URL=https://your-domain.com

# Default target for calls
TARGET_NUMBER=+1234567890

# Mode: 'live' or 'precanned'
MODE=live
```

3. **Start the service**:
```bash
npm start
```

4. **Make a call**:
```bash
./cli.js call --issue "FCC Title II" --number "+12025224261"
```

## Architecture

### Audio Pipeline
```
Twilio Call → WebSocket → Audio Converter → OpenAI Realtime API
     ↑                                            ↓
     ← Audio Converter ← Response Handler ← AI Response
```

### Data Flow
1. **Call initiated**: POST to `/calls` endpoint
2. **Twilio webhook**: Receives call, responds with TwiML
3. **Media stream**: WebSocket connection established
4. **Audio processing**: Real-time conversion and VAD
5. **AI processing**: OpenAI Realtime handles STT/chat/TTS
6. **Response**: Audio sent back through Twilio
7. **Logging**: All turns saved to SQLite

### Database Schema

**calls table**:
- `call_sid` (PRIMARY KEY)
- `stream_sid`
- `ai_session_id` 
- `status`
- `created_at`, `completed_at`, `duration`
- `transcript`, `recording_url`

**transcript_turns table**:
- `call_sid` (FK), `turn_number`
- `speaker` ('user' or 'assistant')
- `content`, `timestamp`
- `audio_blob` (optional raw audio)

## CLI Commands

### Basic calling:
```bash
# Make a live AI call
call-senator call --issue "climate action" --number "+12025224261"

# Use precanned script
call-senator call --mode precanned --script "Hello, I support net neutrality"

# Dry run (no actual call)
call-senator call --issue "healthcare" --dry-run
```

### Preset campaigns:
```bash
# List available presets
call-senator preset --list

# Use preset for FCC Title II
call-senator preset fcc-title-ii

# Use climate action preset
call-senator preset climate-action
```

### Call management:
```bash
# Check recent call status
call-senator status --limit 5

# Get full transcript
call-senator transcript CS1234567890abcdef

# Generate TTS audio file
call-senator generate-script "Hello, this is a test" --output test.wav
```

## Configuration Options

### AI Instructions
Customize the AI's behavior by modifying `aiInstructions` in the config:

```javascript
aiInstructions: `You are calling on behalf of a constituent about [ISSUE]. 
Be polite, concise, and professional. State your position clearly and 
ask for the representative's position on the issue.`
```

### Audio Settings
- **Latency budget**: ~150ms mouth-to-ear
- **Codec conversion**: 8kHz μ-law ↔ 16kHz PCM
- **VAD threshold**: Adjustable energy-based detection
- **Silence timeout**: 300ms trailing silence detection

### Cost Estimation (5-minute call)
- Twilio voice: $0.013/min × 5 = $0.065
- Twilio media: $0.004/min × 5 = $0.020  
- OpenAI Realtime: $0.03/min × 5 = $0.150
- **Total: ~$0.24 per 5-minute call**

## Advanced Features

### Auto-reconnection
- OpenAI sessions auto-reconnect every 9 minutes
- Seamless session handoff without call interruption
- Failed connection retry with exponential backoff

### Anti-detection
- Random 50-150ms timing jitter between calls
- Natural conversation pacing
- Optional background noise injection

### Monitoring & Analytics
- Real-time call status monitoring
- Transcript analysis and keyword extraction
- Call success rate tracking
- Audio quality metrics

## Deployment

### Local Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Production (Docker)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000 3001
CMD ["npm", "start"]
```

### Webhook URLs
Set these in your Twilio console:
- **Voice webhook**: `https://your-domain.com/webhook/voice`
- **Status callback**: `https://your-domain.com/webhook/status`

## Environment Variables

```bash
# Required
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token  
TWILIO_PHONE_NUMBER=+1234567890
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Server
PORT=3000
WS_PORT=3001
DOMAIN=your-domain.com
BASE_URL=https://your-domain.com

# Optional
TARGET_NUMBER=+1234567890  # Default number to call
MODE=live                  # 'live' or 'precanned'
MONITOR_CALLS=true         # Enable call monitoring
LOG_LEVEL=info            # debug, info, warn, error
MAX_CALL_DURATION=300     # Max call length in seconds
```

## Troubleshooting

### Common Issues

**Audio quality problems**:
- Check codec conversion settings
- Verify sample rate conversions
- Adjust VAD threshold

**High latency**:
- Ensure WebSocket connections are stable
- Monitor OpenAI API response times
- Check network connectivity

**Call drops**:
- Verify Twilio webhook URLs are accessible
- Check OpenAI session reconnection logic
- Monitor WebSocket connection health

### Debug Mode
```bash
LOG_LEVEL=debug npm start
```

## Legal Considerations

- Ensure compliance with local calling regulations
- Respect Do Not Call lists
- Consider call recording consent laws
- Use responsibly for legitimate political engagement

## License

MIT License - See LICENSE file for details.
