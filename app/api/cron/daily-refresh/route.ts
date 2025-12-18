import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { logError } from '@/lib/error-handling'

export const maxDuration = 300 // 5 minutes max

interface RefreshResult {
  step: string
  success: boolean
  message: string
  duration?: number
  count?: number
  error?: string
}

export async function GET(request: NextRequest) {
  const results: RefreshResult[] = []
  const startTime = Date.now()
  
  try {
    // Verify the request is from Vercel Cron  
    const headersList = await headers()
    const authHeader = headersList.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // 1. Call the main refresh-data endpoint to update charging stations
    const stationsResult = await refreshChargingStations()
    results.push(stationsResult)

    // CRITICAL: Abort if charging stations refresh failed - don't aggregate with bad/empty data
    if (!stationsResult.success) {
      logError(new Error('Aborting cron - charging stations refresh failed'), 'cron.daily-refresh', {
        reason: 'Cannot proceed with aggregation when station data is invalid',
        stationsResult
      })

      return NextResponse.json({
        success: false,
        message: 'Daily refresh aborted - charging stations refresh failed. Production data preserved.',
        totalDuration: Math.round((Date.now() - startTime) / 1000),
        results,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    // 2. Perform smart incremental aggregation updates (only if stations refresh succeeded)
    results.push(await performSmartAggregation())
    
    // 5. Clean up old data (optional)
    results.push(await cleanupOldData())
    
    const totalDuration = Math.round((Date.now() - startTime) / 1000)
    const allSuccess = results.every(r => r.success)
    
    // Log summary to monitoring
    if (!allSuccess) {
      logError(new Error('Daily refresh had failures'), 'cron.daily-refresh', {
        results,
        totalDuration
      })
    }
    
    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? 'Daily refresh completed successfully' : 'Daily refresh completed with errors',
      totalDuration,
      results,
      timestamp: new Date().toISOString()
    }, { status: allSuccess ? 200 : 207 }) // 207 = Multi-Status
    
  } catch (error) {
    logError(error, 'cron.daily-refresh', { results })
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      results,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

async function refreshChargingStations(): Promise<RefreshResult> {
  const stepStart = Date.now()
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/refresh-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    
    return {
      step: 'refresh-charging-stations',
      success: response.ok && data.success,
      message: data.success ? 'Charging stations refreshed' : 'Failed to refresh charging stations',
      duration: Math.round((Date.now() - stepStart) / 1000),
      count: data.stations_inserted,
      error: data.error
    }
  } catch (error) {
    return {
      step: 'refresh-charging-stations',
      success: false,
      message: 'Error refreshing charging stations',
      duration: Math.round((Date.now() - stepStart) / 1000),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function performSmartAggregation(): Promise<RefreshResult> {
  const stepStart = Date.now()
  try {
    // Call the smart update endpoint to only process regions with changes
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/smart-update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        levels: ['states', 'counties', 'zips'],
        useStaging: true
      })
    })
    
    const data = await response.json()
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Smart aggregation failed')
    }
    
    const totalProcessed = data.states_processed + data.counties_processed + data.zips_processed
    const changesDetected = data.changes_detected.total_changes
    
    return {
      step: 'smart-aggregation',
      success: true,
      message: changesDetected === 0 
        ? 'No changes detected - aggregation skipped for efficiency'
        : `Smart aggregation completed - processed ${totalProcessed} regions based on ${changesDetected} changes`,
      duration: Math.round((Date.now() - stepStart) / 1000),
      count: totalProcessed
    }
  } catch (error) {
    return {
      step: 'smart-aggregation',
      success: false,
      message: 'Error performing smart aggregation',
      duration: Math.round((Date.now() - stepStart) / 1000),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function cleanupOldData(): Promise<RefreshResult> {
  const stepStart = Date.now()
  try {
    // For now, we'll just return success
    // In the future, this could clean up old staging tables, logs, etc.
    return {
      step: 'cleanup-old-data',
      success: true,
      message: 'Cleanup completed (no action needed)',
      duration: Math.round((Date.now() - stepStart) / 1000)
    }
  } catch (error) {
    return {
      step: 'cleanup-old-data',
      success: false,
      message: 'Error during cleanup',
      duration: Math.round((Date.now() - stepStart) / 1000),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}