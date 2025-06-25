import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { openaiApiKey } = await request.json()
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'Missing OpenAI API key' },
        { status: 400 }
      )
    }
    
    // Test OpenAI connection
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      const realtimeModels = data.data.filter((model: any) => 
        model.id.includes('realtime') || model.id.includes('gpt-4o')
      )
      
      return NextResponse.json({ 
        success: true, 
        models: realtimeModels.length,
        hasRealtimeAccess: realtimeModels.length > 0
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('OpenAI test error:', error)
    return NextResponse.json(
      { error: 'Failed to test OpenAI connection' },
      { status: 500 }
    )
  }
}