import { NextRequest, NextResponse } from 'next/server'
import {
    processNRELStation,
    batchInsertStations,
    clearTable,
    swapStagingToProduction
} from '@/lib/data-processor'
import { generateStateData } from '@/lib/aggregation'
import { generateStateDataOptimized } from '@/lib/aggregation-optimized'

// Feature flag to easily switch between implementations
const USE_OPTIMIZED = true

export const maxDuration = 300

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
    const logs: string[] = []

    try {
        logs.push('Starting full data refresh with staging tables...')

        // STEP 1: Fetch from NREL (no database changes yet)
        logs.push('Fetching charging stations from NREL...')
        const apiKey = process.env.NREL_API_KEY

        if (!apiKey) {
            throw new Error('NREL API key not configured')
        }

        const url = `https://developer.nrel.gov/api/alt-fuel-stations/v1.json?api_key=${apiKey}&fuel_type=ELEC&country=US&limit=all&status=E`
        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`NREL API returned ${response.status}`)
        }

        const data = await response.json()
        const rawStations = data.fuel_stations || []
        logs.push(`✓ Fetched ${rawStations.length} stations from NREL`)

        // STEP 2: Process stations (still no database changes)
        logs.push('Processing stations...')
        const processedStations = rawStations
            .filter(
                (station: any) =>
                    station.latitude &&
                    station.longitude &&
                    station.station_name
            )
            .map((station: any) => processNRELStation(station))

        logs.push(`✓ Processed ${processedStations.length} valid stations`)

        // STEP 3: Clear staging tables
        logs.push('Clearing staging tables...')
        await clearTable('charging_stations_staging')
        await clearTable('state_level_data_staging')
        await clearTable('county_level_data_staging')
        await clearTable('zip_level_data_staging')
        await clearTable('neighborhood_level_data_staging')
        logs.push('✓ Staging tables cleared')

        // STEP 4: Insert into staging tables
        logs.push('Inserting stations into STAGING...')
        const insertResult = await batchInsertStations(
            processedStations,
            1000,
            true
        ) // useStaging = true

        if (insertResult.errors > 0) {
            throw new Error(
                `Failed to insert stations: ${insertResult.errors} errors`
            )
        }

        logs.push(`✓ Inserted ${insertResult.inserted} stations into staging`)

        // STEP 5: Generate aggregations in staging
        logs.push('Generating state-level aggregations in STAGING...')
        const stateCount = USE_OPTIMIZED
            ? await generateStateDataOptimized(true) // useStaging = true
            : await generateStateData(true)
        logs.push(`✓ Generated ${stateCount} states in staging`)

        // STEP 6: Atomic swap - production stays untouched until here
        logs.push('Performing atomic swap: staging → production...')
        const swapSuccess = await swapStagingToProduction()

        if (!swapSuccess) {
            throw new Error('Failed to swap staging to production')
        }

        logs.push('✓ Successfully swapped staging to production')
        logs.push('✓ Production data is now live with zero downtime!')

        const duration = Math.round((Date.now() - startTime) / 1000)
        logs.push(`Completed in ${duration} seconds`)

        return NextResponse.json({
            success: true,
            duration_seconds: duration,
            stations_fetched: rawStations.length,
            stations_inserted: insertResult.inserted,
            states_generated: stateCount,
            logs: logs
        })
    } catch (error) {
        logs.push(
            `❌ ERROR: ${
                error instanceof Error ? error.message : 'Unknown error'
            }`
        )
        logs.push('Production data remains unchanged (rollback successful)')
        console.error('Refresh data error:', error)

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to refresh data',
                logs: logs
            },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const secret = searchParams.get('secret')

    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return POST(request)
}
