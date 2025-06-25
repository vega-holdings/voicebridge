import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { twilioAccountSid, twilioAuthToken } = await request.json()
    
    if (!twilioAccountSid || !twilioAuthToken) {
      return NextResponse.json(
        { error: 'Missing Twilio credentials' },
        { status: 400 }
      )
    }
    
    // Test Twilio connection
    const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')
    
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}.json`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({ 
        success: true, 
        account: {
          friendlyName: data.friendly_name,
          status: data.status
        }
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid Twilio credentials' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Twilio test error:', error)
    return NextResponse.json(
      { error: 'Failed to test Twilio connection' },
      { status: 500 }
    )
  }
}