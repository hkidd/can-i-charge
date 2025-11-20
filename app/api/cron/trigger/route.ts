import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Check for admin authentication (you could use a different auth method)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Trigger the daily refresh
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/cron/daily-refresh`, {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    })
    
    const data = await response.json()
    
    return NextResponse.json({
      success: response.ok,
      triggered: true,
      cronResponse: data
    }, { status: response.status })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger cron'
    }, { status: 500 })
  }
}

// GET endpoint for easier testing
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const secret = searchParams.get('secret')
  
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ 
      error: 'Unauthorized',
      message: 'Please provide the correct secret in the query parameter'
    }, { status: 401 })
  }
  
  // Create a new request with proper auth header
  const newRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${secret}`
    }
  })
  
  return POST(newRequest)
}