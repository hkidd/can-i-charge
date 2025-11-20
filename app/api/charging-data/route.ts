import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateResponse, ChargingDataResponseSchema } from '@/lib/api-validation'
import { ApiResponseError, logError } from '@/lib/error-handling'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const zoom = parseInt(searchParams.get('zoom') || '4')
    const north = parseFloat(searchParams.get('north') || '90')
    const south = parseFloat(searchParams.get('south') || '-90')
    const east = parseFloat(searchParams.get('east') || '180')
    const west = parseFloat(searchParams.get('west') || '-180')

    let tableName: string
    let granularity: string
    let useFunction = false

    // Determine which table to query based on zoom level
    if (zoom <= 4) {
        tableName = 'state_level_data'
        granularity = 'state'
    } else if (zoom <= 8) {
        tableName = 'county_level_data'
        granularity = 'county'
    } else {
        // Zoom 9+ always uses ZIP level data with PostGIS function
        tableName = 'zip_level_data'
        granularity = 'zip'
        useFunction = true // Use PostGIS function for geometry and performance
    }

    try {
        let data, error, count

        if (useFunction) {
            // Use PostGIS function for ZIP geometries
            const result = await supabaseAdmin.rpc(
                'get_zip_data_with_geometry',
                {
                    p_north: north,
                    p_south: south,
                    p_east: east,
                    p_west: west
                }
            )

            data = result.data
            error = result.error
            count = data?.length || 0
        } else {
            // Standard query for other levels
            const result = await supabaseAdmin
                .from(tableName)
                .select('*', { count: 'exact' })
                .gte('center_lat', south)
                .lte('center_lat', north)
                .gte('center_lng', west)
                .lte('center_lng', east)
                .order('ev_infrastructure_score', { ascending: false })

            data = result.data
            error = result.error
            count = result.count
        }

        if (error) {
            logError(error, `api.charging-data.${granularity}`, { zoom, bounds: { north, south, east, west } })
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const response = {
            zoom,
            granularity,
            bounds: { north, south, east, west },
            count: count || 0,
            data: data || []
        }
        
        // Safe validation - log errors but don't fail the request
        try {
            validateResponse(ChargingDataResponseSchema, response, 'charging-data')
        } catch (validationError) {
            // Log validation error but continue with response
            logError(validationError, 'api.charging-data.validation', { granularity, dataCount: data?.length })
        }
        
        return NextResponse.json(response)
    } catch (error) {
        logError(error, 'api.charging-data', { zoom, north, south, east, west })
        
        if (error instanceof ApiResponseError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.statusCode || 500 }
            )
        }
        
        return NextResponse.json(
            { error: 'Failed to fetch charging data' },
            { status: 500 }
        )
    }
}
