# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Twilio-OpenAI voice bridge that enables AI-powered phone conversations. It connects Twilio voice calls to OpenAI's Realtime API for real-time speech-to-speech AI interactions, primarily designed for automated political advocacy calling.

## Development Commands

### Starting the service
```bash
npm install        # Install dependencies (run first)
npm start          # Start the bridge service
npm run dev        # Start with nodemon for development
```

### Making calls
```bash
npm run call       # Execute CLI tool
./cli.js call --issue "climate action" --number "+12025224261"
call-senator call --issue "net neutrality" --number "+12025224261"
```

### CLI operations
```bash
call-senator status --limit 5                    # Check recent calls
call-senator transcript CS1234567890abcdef       # Get call transcript
call-senator preset fcc-title-ii                 # Use preset campaign
call-senator generate-script "Hello world"       # Generate TTS audio
```

## Architecture

### Core Components
- **bridge.js**: Main service class handling Twilio webhooks, WebSocket connections, and OpenAI integration
- **cli.js**: Command-line interface for initiating calls and managing campaigns
- **calls.db**: SQLite database storing call records and transcripts

### Audio Pipeline
1. Twilio receives call → WebSocket media stream established
2. Audio conversion: 8kHz μ-law (Twilio) ↔ 16kHz PCM (OpenAI)
3. Voice Activity Detection (VAD) processes incoming audio
4. OpenAI Realtime API handles speech-to-text, conversation, and text-to-speech
5. Response audio converted back to μ-law and sent to Twilio

### Session Management
- OpenAI WebSocket connections auto-reconnect every 9 minutes to avoid 10-minute timeout
- Active sessions tracked in memory map with cleanup on call completion
- Database stores full call lifecycle and transcript turns

## Configuration

### Environment Setup
Copy `.env.example` to `.env` and configure:
- Twilio credentials (account SID, auth token, phone number)
- OpenAI API key
- Server ports and domain
- Target numbers and default mode

### Operating Modes
- **live**: Real-time AI conversations via OpenAI Realtime API
- **precanned**: Pre-generated TTS audio playback

## Database Schema

### calls table
- `call_sid`: Twilio call identifier (PRIMARY KEY)
- `stream_sid`: WebSocket stream identifier
- `ai_session_id`: OpenAI session UUID
- `status`, `created_at`, `completed_at`, `duration`
- `transcript`: Full conversation summary
- `recording_url`: Optional Twilio recording

### transcript_turns table
- `call_sid`: Foreign key to calls
- `turn_number`: Sequential turn in conversation
- `speaker`: 'user' or 'assistant'
- `content`: Transcribed text
- `audio_blob`: Optional raw audio data

## Key Integration Points

### Twilio Webhooks
- `/webhook/voice`: Handles incoming calls, returns TwiML
- `/webhook/status`: Receives call status updates
- WebSocket endpoint: `/websocket/{callSid}` for media streaming

### OpenAI Realtime API
- WebSocket connection to `wss://api.openai.com/v1/realtime`
- Real-time audio processing with PCM16 format
- Server-side VAD with configurable thresholds
- Session configuration includes voice, instructions, and turn detection

### Audio Processing
- Uses `mulaw-pcm` library for μ-law ↔ PCM conversion
- Uses `soxr` library for sample rate conversion (8kHz ↔ 16kHz)
- Energy-based VAD for voice activity detection
- Buffer management for real-time audio streaming
- Proper audio format handling: Twilio μ-law → PCM → OpenAI

## Important Implementation Details

- **WebSocket Management**: Proper connection tracking with Map-based storage
- **Audio Conversion**: Two-stage process: μ-law/PCM conversion + sample rate conversion
- **Error Handling**: Exponential backoff retry logic (max 3 retries, 2^n second delays)
- **Connection Validation**: State checks before WebSocket operations
- **Session Lifecycle**: Auto-reconnection every 9 minutes to avoid OpenAI timeout
- **Anti-detection**: Random jitter (50-150ms) between operations
- **Memory Management**: Active session cleanup and connection pooling
- **Security**: Environment-based configuration, no hardcoded credentials

## Recent Improvements Applied

Based on OpenAI's official demo, the following critical fixes were implemented:

1. **Fixed WebSocket tracking**: `findTwilioConnection()` now properly maintains connection map
2. **Improved audio conversion**: Added `mulaw-pcm` library for proper μ-law handling
3. **Updated OpenAI model**: Using latest `gpt-4o-realtime-preview-2024-12-17`
4. **Enhanced error handling**: Exponential backoff retry with connection state validation
5. **Connection state checks**: Validates WebSocket readiness before operations