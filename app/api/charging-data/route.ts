import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { validateResponse, ChargingDataResponseSchema } from '@/lib/api-validation'
import { logError } from '@/lib/error-handling'
import { readAllPages } from '@/lib/db-pagination'

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
        const database = getSupabaseAdmin()
        const signal = AbortSignal.timeout(15000)
        let data: Record<string, unknown>[]
        if (useFunction) {
            const geometries = await readAllPages<Record<string, unknown>>((from, to) => database
                .rpc('get_zip_data_with_geometry', {
                    p_north: north, p_south: south, p_east: east, p_west: west
                }).order('zip_code').range(from, to).abortSignal(signal))

            // Older geometry RPCs return a fixed column list. Read current scoring fields
            // from the table instead of silently losing new capacity and quality columns.
            const zipCodes = [...new Set(geometries.map(row => String(row.zip_code)))]
            const summaries = new Map<string, Record<string, unknown>>()
            for (let offset = 0; offset < zipCodes.length; offset += 200) {
                const batch = zipCodes.slice(offset, offset + 200)
                const rows = await readAllPages<Record<string, unknown>>((from, to) => database
                    .from('zip_level_data').select('*').in('zip_code', batch)
                    .order('zip_code').range(from, to).abortSignal(signal))
                for (const row of rows) summaries.set(String(row.zip_code), row)
            }
            data = geometries.map(row => {
                const summary = summaries.get(String(row.zip_code))
                if (!summary) throw new Error('Missing ZIP scoring data')
                return { ...row, ...summary, geometry: row.geometry }
            })
        } else {
            const orderColumn = granularity === 'state' ? 'state_name' : 'id'
            data = await readAllPages<Record<string, unknown>>((from, to) => database
                .from(tableName).select('*')
                .gte('center_lat', south).lte('center_lat', north)
                .gte('center_lng', west).lte('center_lng', east)
                .order(orderColumn).range(from, to).abortSignal(signal))
        }

        const response = validateResponse(ChargingDataResponseSchema, {
            zoom, granularity, bounds: { north, south, east, west }, count: data.length, data
        }, 'charging-data')
        return NextResponse.json(response)
    } catch (error) {
        logError(error, 'api.charging-data', { zoom, north, south, east, west })
        return NextResponse.json({ error: 'Failed to fetch charging data' }, { status: 503 })
    }
}
