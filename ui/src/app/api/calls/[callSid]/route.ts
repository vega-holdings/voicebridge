import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { callSid: string } }
) {
  try {
    const { callSid } = params

    // Forward to bridge service to terminate call
    const bridgeResponse = await fetch(
      `${process.env.BRIDGE_URL || 'http://localhost:3000'}/calls/${callSid}`,
      {
        method: 'DELETE',
      }
    )

    if (!bridgeResponse.ok) {
      throw new Error('Failed to terminate call')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Call termination API error:', error)
    return NextResponse.json(
      { error: 'Failed to terminate call' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { callSid: string } }
) {
  try {
    const { callSid } = params

    // Fetch call details from bridge service
    const bridgeResponse = await fetch(
      `${process.env.BRIDGE_URL || 'http://localhost:3000'}/calls/${callSid}`
    )

    if (!bridgeResponse.ok) {
      throw new Error('Failed to fetch call details')
    }

    const data = await bridgeResponse.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Call details API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call details' },
      { status: 500 }
    )
  }
}