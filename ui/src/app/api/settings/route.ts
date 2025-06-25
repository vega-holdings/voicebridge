import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'

const SETTINGS_FILE = join(process.cwd(), '..', '.env')

export async function GET() {
  try {
    // Read current settings from .env file
    const envContent = await readFile(SETTINGS_FILE, 'utf-8')
    const settings: { [key: string]: string } = {}
    
    envContent.split('\n').forEach(line => {
      const [key, ...values] = line.split('=')
      if (key && key.trim() && !key.startsWith('#')) {
        settings[key.trim()] = values.join('=').trim()
      }
    })
    
    // Return safe settings (without sensitive values)
    const safeSettings = {
      twilioAccountSid: settings.TWILIO_ACCOUNT_SID || '',
      twilioPhoneNumber: settings.TWILIO_PHONE_NUMBER || '',
      openaiModel: settings.OPENAI_MODEL || 'gpt-4o-realtime-preview-2024-12-17',
      openaiVoice: settings.OPENAI_VOICE || 'alloy',
      port: settings.PORT || '3000',
      wsPort: settings.WS_PORT || '3001',
      domain: settings.DOMAIN || 'localhost:3000',
      baseUrl: settings.BASE_URL || 'http://localhost',
      maxCallDuration: settings.MAX_CALL_DURATION || '300',
      vadThreshold: settings.VAD_THRESHOLD || '1000000',
      silenceTimeout: settings.SILENCE_TIMEOUT_MS || '300',
      reconnectInterval: settings.RECONNECT_INTERVAL_MS || '540000',
      enableJitter: settings.ENABLE_JITTER === 'true',
      minJitterMs: settings.MIN_JITTER_MS || '50',
      maxJitterMs: settings.MAX_JITTER_MS || '150',
      userOrganization: settings.USER_ORGANIZATION || '',
      userLocation: settings.USER_LOCATION || '',
      userRole: settings.USER_ROLE || 'concerned citizen'
    }
    
    return NextResponse.json(safeSettings)
  } catch (error) {
    console.error('Settings read error:', error)
    return NextResponse.json(
      { error: 'Failed to read settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings = await request.json()
    
    // Build new .env content
    const envLines = [
      '# .env - Voice Bridge Configuration',
      '',
      '# Twilio Configuration',
      `TWILIO_ACCOUNT_SID=${settings.twilioAccountSid || ''}`,
      `TWILIO_AUTH_TOKEN=${settings.twilioAuthToken || ''}`,
      `TWILIO_PHONE_NUMBER=${settings.twilioPhoneNumber || ''}`,
      '',
      '# OpenAI Configuration',
      `OPENAI_API_KEY=${settings.openaiApiKey || ''}`,
      `OPENAI_MODEL=${settings.openaiModel || 'gpt-4o-realtime-preview-2024-12-17'}`,
      `OPENAI_VOICE=${settings.openaiVoice || 'alloy'}`,
      '',
      '# Server Configuration',
      `PORT=${settings.port || '3000'}`,
      `WS_PORT=${settings.wsPort || '3001'}`,
      `DOMAIN=${settings.domain || 'localhost:3000'}`,
      `BASE_URL=${settings.baseUrl || 'http://localhost'}`,
      '',
      '# AI Configuration',
      `AI_INSTRUCTIONS=${settings.aiInstructions || ''}`,
      `SYSTEM_PERSONA=${settings.systemPersona || ''}`,
      '',
      '# User Information',
      `USER_ORGANIZATION=${settings.userOrganization || ''}`,
      `USER_LOCATION=${settings.userLocation || ''}`,
      `USER_ROLE=${settings.userRole || 'concerned citizen'}`,
      '',
      '# Call Settings',
      `MAX_CALL_DURATION=${settings.maxCallDuration || '300'}`,
      `VAD_THRESHOLD=${settings.vadThreshold || '1000000'}`,
      `SILENCE_TIMEOUT_MS=${settings.silenceTimeout || '300'}`,
      `RECONNECT_INTERVAL_MS=${settings.reconnectInterval || '540000'}`,
      '',
      '# Anti-detection Settings',
      `ENABLE_JITTER=${settings.enableJitter ? 'true' : 'false'}`,
      `MIN_JITTER_MS=${settings.minJitterMs || '50'}`,
      `MAX_JITTER_MS=${settings.maxJitterMs || '150'}`,
    ]
    
    await writeFile(SETTINGS_FILE, envLines.join('\n'))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings save error:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}