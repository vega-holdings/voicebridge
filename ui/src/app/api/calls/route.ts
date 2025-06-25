import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, contact, legislation, script, talkingPoints } = body

    // Forward to the bridge service
    const bridgeResponse = await fetch(`${process.env.BRIDGE_URL || 'http://localhost:3000'}/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        issue: legislation,
        script: `${script}\n\nKey Points: ${talkingPoints}`,
        contact
      })
    })

    if (!bridgeResponse.ok) {
      throw new Error('Failed to initiate call')
    }

    const data = await bridgeResponse.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Call API error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate call' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Fetch call history from bridge service
    const bridgeResponse = await fetch(`${process.env.BRIDGE_URL || 'http://localhost:3000'}/calls/history`)
    
    if (!bridgeResponse.ok) {
      throw new Error('Failed to fetch call history')
    }

    const data = await bridgeResponse.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Call history API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call history' },
      { status: 500 }
    )
  }
}