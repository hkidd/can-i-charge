import { NextRequest, NextResponse } from 'next/server'
import { SmartAggregator } from '@/lib/smart-aggregator'
import { swapStagingToProduction } from '@/lib/data-processor'

function isAuthorized(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET
    
    // Check for cron/external authorization
    const authHeader = request.headers.get('authorization')
    if (authHeader === `Bearer ${cronSecret}`) {
        return true
    }
    
    // Check for admin page authorization 
    const adminHeader = request.headers.get('x-admin-request')
    if (adminHeader === 'true' && cronSecret) {
        return true
    }
    
    return false
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    
    try {
        // Parse request body for configuration
        const body = await request.json().catch(() => ({}))
        const levels = body.levels || ['states', 'counties', 'zips']
        const useStaging = body.useStaging !== false // Default to true
        
        console.log('🧠 Starting smart incremental update...')
        console.log(`📊 Levels: ${levels.join(', ')}`)
        console.log(`🗄️  Using staging: ${useStaging}`)

        // Perform smart incremental update
        const result = await SmartAggregator.performIncrementalUpdate(levels, useStaging)
        
        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error,
                duration_seconds: result.duration_seconds
            }, { status: 500 })
        }
        
        // If using staging and we processed changes, check if ZIP processing is complete before swapping
        if (useStaging && result.changes_detected.total_changes > 0) {
            if (!result.zip_completion.is_complete) {
                console.log(`⏳ ZIP processing incomplete (${result.zip_completion.percentage}%) - skipping swap until all ZIPs are processed`)
                console.log(`📊 Progress: ${result.zip_completion.completed}/${result.zip_completion.total_affected} ZIP codes completed`)
                
                return NextResponse.json({
                    ...result,
                    success: true,
                    message: `Smart update in progress - ${result.zip_completion.remaining} ZIP codes remaining`,
                    swap_performed: false
                })
            }
            
            console.log('🔄 All ZIP processing complete! Performing atomic swap: staging → production...')
            const swapSuccess = await swapStagingToProduction()
            
            if (!swapSuccess) {
                return NextResponse.json({
                    ...result,
                    success: false,
                    error: 'Smart update completed but failed to swap to production'
                }, { status: 500 })
            }
            
            console.log('✅ Smart update completed with zero downtime!')
        }

        return NextResponse.json({
            ...result,
            success: true,
            message: result.changes_detected.total_changes === 0 
                ? 'No changes detected - aggregation skipped' 
                : 'Smart incremental update completed successfully',
            swap_performed: useStaging && result.changes_detected.total_changes > 0 && result.zip_completion.is_complete
        })

    } catch (error) {
        console.error('Smart update failed:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Smart update failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                duration_seconds: (Date.now() - startTime) / 1000
            },
            { status: 500 }
        )
    }
}

// GET endpoint for cron jobs
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const secret = searchParams.get('secret')
    const level = searchParams.get('level') || 'states'

    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create a request body for the POST method
    const mockRequest = new Request(request.url, {
        method: 'POST',
        headers: {
            'authorization': `Bearer ${secret}`,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            levels: [level],
            useStaging: true
        })
    })

    return POST(mockRequest as NextRequest)
}