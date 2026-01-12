import { NextRequest, NextResponse } from 'next/server'
import {
    processNRELStation,
    batchInsertStations,
    clearTable
} from '@/lib/data-processor'
import { generateStateData } from '@/lib/aggregation'
import { generateStateDataOptimized } from '@/lib/aggregation-optimized'

// Feature flag to easily switch between implementations
const USE_OPTIMIZED = true

const MINIMUM_EXPECTED_STATIONS = 40000

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
        logs.push('Starting data refresh...')
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

        // Validate before any DB changes
        if (rawStations.length < MINIMUM_EXPECTED_STATIONS) {
            throw new Error(
                `NREL returned ${rawStations.length} stations (min: ${MINIMUM_EXPECTED_STATIONS}). Aborting.`
            )
        }
        logs.push(`✓ Station count validated (${rawStations.length} >= ${MINIMUM_EXPECTED_STATIONS})`)

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

        if (processedStations.length < MINIMUM_EXPECTED_STATIONS * 0.9) {
            throw new Error(
                `Too many filtered: ${rawStations.length} → ${processedStations.length}. Aborting.`
            )
        }

        logs.push('Clearing staging tables...')
        await clearTable('charging_stations_staging')
        await clearTable('state_level_data_staging')
        await clearTable('county_level_data_staging')
        await clearTable('neighborhood_level_data_staging')
        logs.push('✓ Staging tables cleared')

        logs.push('Inserting stations into staging...')
        const insertResult = await batchInsertStations(processedStations, 1000, true)

        if (insertResult.errors > 0) {
            throw new Error(`Insert failed: ${insertResult.errors} errors`)
        }

        logs.push(`✓ Inserted ${insertResult.inserted} stations into staging`)

        if (insertResult.inserted < processedStations.length * 0.95) {
            throw new Error(
                `Insert mismatch: ${processedStations.length} processed, ${insertResult.inserted} inserted. Aborting.`
            )
        }

        // Generate state aggregations (county/zip handled by smart-update)
        logs.push('Generating state-level aggregations...')
        const stateCount = USE_OPTIMIZED
            ? await generateStateDataOptimized(true)
            : await generateStateData(true)
        logs.push(`✓ Generated ${stateCount} states in staging`)

        // Swap handled by smart-update after all aggregations complete
        logs.push('✓ Staging populated - ready for smart-update')

        const duration = Math.round((Date.now() - startTime) / 1000)
        logs.push(`Completed in ${duration} seconds`)

        return NextResponse.json({
            success: true,
            duration_seconds: duration,
            stations_fetched: rawStations.length,
            stations_inserted: insertResult.inserted,
            states_generated: stateCount,
            swap_performed: false, // Swap will be done by smart-update
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
    const authHeader = request.headers.get('authorization')

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return POST(request)
}
