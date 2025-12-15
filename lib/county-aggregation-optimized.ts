import { supabaseAdmin } from './supabase'
import * as topojson from 'topojson-client'
import { fetchCountyPopulation } from './census-api'
import { calculateNeedScore } from './scoring'
import { calculateWeightedEVScore } from './aggregation-optimized'

// Utility function to get state code from FIPS
function getStateCodeFromFIPS(fips: string): string | null {
    const fipsToState: Record<string, string> = {
        '01': 'AL',
        '02': 'AK',
        '04': 'AZ',
        '05': 'AR',
        '06': 'CA',
        '08': 'CO',
        '09': 'CT',
        '10': 'DE',
        '12': 'FL',
        '13': 'GA',
        '15': 'HI',
        '16': 'ID',
        '17': 'IL',
        '18': 'IN',
        '19': 'IA',
        '20': 'KS',
        '21': 'KY',
        '22': 'LA',
        '23': 'ME',
        '24': 'MD',
        '25': 'MA',
        '26': 'MI',
        '27': 'MN',
        '28': 'MS',
        '29': 'MO',
        '30': 'MT',
        '31': 'NE',
        '32': 'NV',
        '33': 'NH',
        '34': 'NJ',
        '35': 'NM',
        '36': 'NY',
        '37': 'NC',
        '38': 'ND',
        '39': 'OH',
        '40': 'OK',
        '41': 'OR',
        '42': 'PA',
        '44': 'RI',
        '45': 'SC',
        '46': 'SD',
        '47': 'TN',
        '48': 'TX',
        '49': 'UT',
        '50': 'VT',
        '51': 'VA',
        '53': 'WA',
        '54': 'WV',
        '55': 'WI',
        '56': 'WY'
    }
    return fipsToState[fips] || null
}

// Calculate polygon bounds
function getPolygonBounds(coordinates: any): {
    north: number
    south: number
    east: number
    west: number
} {
    let minLat = Infinity,
        maxLat = -Infinity
    let minLng = Infinity,
        maxLng = -Infinity

    const processCoordinate = (coord: number[]) => {
        const [lng, lat] = coord
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
    }

    const processRing = (ring: any) => {
        ring.forEach(processCoordinate)
    }

    if (Array.isArray(coordinates[0][0][0])) {
        // MultiPolygon
        coordinates.forEach((polygon: any) => polygon.forEach(processRing))
    } else if (Array.isArray(coordinates[0][0])) {
        // Polygon
        coordinates.forEach(processRing)
    }

    return { north: maxLat, south: minLat, east: maxLng, west: minLng }
}

// Check if a point is roughly within bounds (with buffer)
function isInBounds(
    lat: number,
    lng: number,
    bounds: any,
    buffer: number = 0.05
): boolean {
    return (
        lat >= bounds.south - buffer &&
        lat <= bounds.north + buffer &&
        lng >= bounds.west - buffer &&
        lng <= bounds.east + buffer
    )
}

export async function generateCountyDataOptimized(
    useStaging: boolean = false
): Promise<number> {
    console.log('🚀 Generating county-level data (OPTIMIZED)...')
    const startTime = Date.now()

    const tableName = useStaging
        ? 'county_level_data_staging'
        : 'county_level_data'
    const stationsTable = 'charging_stations' // Always use production charging_stations table

    try {
        // Clear existing data
        console.log(`Clearing ${tableName}...`)
        await supabaseAdmin
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000')

        // Fetch county boundaries
        console.log('🗺️ Fetching US county boundaries...')
        const topoResponse = await fetch(
            'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
        )
        const topology = await topoResponse.json()
        const countiesGeo = topojson.feature(
            topology,
            topology.objects.counties
        )

        console.log(
            `📍 Processing ${(countiesGeo as any).features.length} counties...`
        )

        // Get ALL stations in one query
        console.log('⚡ Fetching ALL charging stations in ONE query...')
        const { data: allStations, error } = await supabaseAdmin
            .from(stationsTable)
            .select(
                'latitude, longitude, state, charger_type_detailed, ev_connector_types, num_ports'
            )
            .range(0, 999999)

        if (error) throw error
        console.log(`✅ Fetched ${allStations?.length || 0} stations`)

        // Process counties
        const countyData: any[] = []
        let processedCount = 0
        const totalCounties = (countiesGeo as any).features.length

        console.log('🔄 Processing counties with in-memory calculations...')

        for (const feature of (countiesGeo as any).features) {
            const countyName = feature.properties.name
            const stateId = feature.id.toString().substring(0, 2)
            const stateCode = getStateCodeFromFIPS(stateId)

            if (!stateCode) continue

            const bounds = getPolygonBounds(feature.geometry.coordinates)
            const centerLat = (bounds.north + bounds.south) / 2
            const centerLng = (bounds.east + bounds.west) / 2

            // Count chargers and ports in this county (in memory)
            let dcfastCount = 0
            let level2Count = 0
            let level1Count = 0
            let teslaCount = 0
            let ccsCount = 0
            let j1772Count = 0
            let chademoCount = 0
            let teslaPorts = 0
            let ccsPorts = 0
            let j1772Ports = 0
            let chademoPorts = 0
            let totalPorts = 0

            for (const station of allStations || []) {
                // Quick bounds check first
                if (
                    station.state === stateCode &&
                    isInBounds(station.latitude, station.longitude, bounds)
                ) {
                    const numPorts = station.num_ports || 1
                    totalPorts += numPorts

                    // Count by charger level
                    switch (station.charger_type_detailed) {
                        case 'dcfast':
                            dcfastCount++
                            break
                        case 'level2':
                            level2Count++
                            break
                        case 'level1':
                            level1Count++
                            break
                    }

                    // Count by connector type (stations and ports)
                    const connectorTypes = station.ev_connector_types || []
                    if (connectorTypes.includes('TESLA')) {
                        teslaCount++
                        teslaPorts += numPorts
                    }
                    const hasNonTesla = connectorTypes.some((type: string) =>
                        ['J1772COMBO', 'J1772', 'CHADEMO'].includes(type)
                    )
                    if (hasNonTesla) {
                        ccsCount++
                        ccsPorts += numPorts
                    }
                    if (
                        connectorTypes.includes('J1772') &&
                        !connectorTypes.includes('J1772COMBO')
                    ) {
                        j1772Count++
                        j1772Ports += numPorts
                    }
                    if (connectorTypes.includes('CHADEMO')) {
                        chademoCount++
                        chademoPorts += numPorts
                    }
                }
            }

            const totalChargers = dcfastCount + level2Count + level1Count

            // Include ALL counties (even those with 0 chargers) for complete coverage

            // Get population (this is still slow but necessary)
            const fullFips = feature.id.toString().padStart(5, '0')
            const stateFips = fullFips.substring(0, 2)
            const countyFips = fullFips.substring(2, 5)
            const population = await fetchCountyPopulation(
                stateFips,
                countyFips
            )

            const needScore = calculateNeedScore(population, totalChargers)
            const weightedChargerCount =
                dcfastCount * 1.0 + level2Count * 0.7 + level1Count * 0.3
            const score = calculateWeightedEVScore(
                weightedChargerCount,
                population
            )

            countyData.push({
                county_name: countyName,
                state: stateCode,
                center_lat: centerLat,
                center_lng: centerLng,
                population,
                charger_count: totalChargers,
                level1_count: level1Count,
                level2_count: level2Count,
                dcfast_count: dcfastCount,
                tesla_count: teslaCount,
                ccs_count: ccsCount,
                j1772_count: j1772Count,
                chademo_count: chademoCount,
                tesla_ports: teslaPorts,
                ccs_ports: ccsPorts,
                j1772_ports: j1772Ports,
                chademo_ports: chademoPorts,
                total_ports: totalPorts,
                need_score: needScore,
                ev_infrastructure_score: score,
                zoom_range: '5-8'
            })

            processedCount++

            // Progress update every 100 counties
            if (processedCount % 100 === 0) {
                const percentage = (
                    (processedCount / totalCounties) *
                    100
                ).toFixed(1)
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                console.log(
                    `Progress: ${processedCount}/${totalCounties} (${percentage}%) - ${elapsed}s`
                )
            }

            // Batch insert every 500 counties to avoid memory issues
            if (countyData.length >= 500) {
                const { error: insertError } = await supabaseAdmin
                    .from(tableName)
                    .insert(countyData)

                if (insertError) throw insertError

                countyData.length = 0 // Clear array
            }
        }

        // Insert remaining counties
        if (countyData.length > 0) {
            console.log(`💾 Inserting final ${countyData.length} counties...`)
            const { error: insertError } = await supabaseAdmin
                .from(tableName)
                .insert(countyData)

            if (insertError) throw insertError
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log(
            `✅ County generation complete in ${duration} seconds (was ~900-1200s)`
        )
        console.log(`📊 Processed ${processedCount} counties`)

        return processedCount
    } catch (error) {
        console.error('County generation failed:', error)
        throw error
    }
}
