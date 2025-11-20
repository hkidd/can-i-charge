import { supabaseAdmin } from './supabase'
import * as topojson from 'topojson-client'

// Helper: Delay function
function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// Helper: Retry fetch with exponential backoff
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url)
            if (response.ok) return response
            throw new Error(`HTTP ${response.status}`)
        } catch (error) {
            if (i === retries - 1) throw error
            await delay(1000 * Math.pow(2, i)) // Exponential backoff: 1s, 2s, 4s
            console.log(`Retry ${i + 1}/${retries} for ${url}`)
        }
    }
    throw new Error('Max retries exceeded')
}

export async function generateCountyData(
    useStaging: boolean = false
): Promise<number> {
    console.log('Generating county-level data...')

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

        // Fetch county boundaries with retry
        console.log('Fetching US county boundaries...')
        const topoResponse = await fetchWithRetry(
            'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
        )
        const topology = await topoResponse.json()
        const countiesGeo = topojson.feature(
            topology,
            topology.objects.counties
        )

        console.log(
            `Processing ${(countiesGeo as any).features.length} counties...`
        )

        let countyData: any[] = []
        let processedCount = 0
        let batchCount = 0
        let errorCount = 0

        // Process each county
        for (const feature of (countiesGeo as any).features) {
            try {
                const countyName = feature.properties.name
                const stateId = feature.id.toString().substring(0, 2)
                const stateCode = getStateCodeFromFIPS(stateId)

                if (!stateCode) continue

                // Calculate bounds
                const bounds = getBounds(feature.geometry)
                const centerLat = (bounds.north + bounds.south) / 2
                const centerLng = (bounds.east + bounds.west) / 2

                // Count each charger type separately with retry
                let dcfastCount = 0,
                    level2Count = 0,
                    level1Count = 0

                try {
                    const { count: dc } = await supabaseAdmin
                        .from(stationsTable)
                        .select('*', { count: 'exact', head: true })
                        .eq('state', stateCode)
                        .eq('charger_type_detailed', 'dcfast')
                        .gte('latitude', bounds.south - 0.05)
                        .lte('latitude', bounds.north + 0.05)
                        .gte('longitude', bounds.west - 0.05)
                        .lte('longitude', bounds.east + 0.05)
                    dcfastCount = dc || 0

                    const { count: l2 } = await supabaseAdmin
                        .from(stationsTable)
                        .select('*', { count: 'exact', head: true })
                        .eq('state', stateCode)
                        .eq('charger_type_detailed', 'level2')
                        .gte('latitude', bounds.south - 0.05)
                        .lte('latitude', bounds.north + 0.05)
                        .gte('longitude', bounds.west - 0.05)
                        .lte('longitude', bounds.east + 0.05)
                    level2Count = l2 || 0

                    const { count: l1 } = await supabaseAdmin
                        .from(stationsTable)
                        .select('*', { count: 'exact', head: true })
                        .eq('state', stateCode)
                        .eq('charger_type_detailed', 'level1')
                        .gte('latitude', bounds.south - 0.05)
                        .lte('latitude', bounds.north + 0.05)
                        .gte('longitude', bounds.west - 0.05)
                        .lte('longitude', bounds.east + 0.05)
                    level1Count = l1 || 0
                } catch (queryError) {
                    console.error(
                        `Error querying chargers for ${countyName}, ${stateCode}:`,
                        queryError
                    )
                    errorCount++
                    // Continue with zeros if queries fail
                }

                const dcFast = dcfastCount
                const level2 = level2Count
                const level1 = level1Count
                const totalChargers = dcFast + level2 + level1

                const weightedChargerCount =
                    dcFast * 1.0 + level2 * 0.7 + level1 * 0.3

                const population = estimateCountyPopulation()
                const needScore = calculateNeedScore(population, totalChargers)
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
                    level1_count: level1,
                    level2_count: level2,
                    dcfast_count: dcFast,
                    need_score: needScore,
                    ev_infrastructure_score: score,
                    zoom_range: '5-8'
                })

                processedCount++

                if (processedCount % 100 === 0) {
                    console.log(
                        `Processed ${processedCount} counties (${errorCount} errors)...`
                    )
                }

                // Batch insert every 100 counties
                if (countyData.length >= 100) {
                    batchCount++
                    console.log(
                        `Inserting batch ${batchCount} (100 counties)...`
                    )

                    try {
                        const { error } = await supabaseAdmin
                            .from(tableName)
                            .insert(countyData)
                        if (error) {
                            console.error('Batch insert error:', error)
                            // Try one more time with smaller batch
                            await delay(2000)
                            const { error: retryError } = await supabaseAdmin
                                .from(tableName)
                                .insert(countyData)
                            if (retryError) {
                                console.error(
                                    'Retry insert also failed:',
                                    retryError
                                )
                                errorCount += countyData.length
                            }
                        }
                    } catch (insertError) {
                        console.error('Insert exception:', insertError)
                        errorCount += countyData.length
                    }

                    countyData = []

                    // Add small delay between batches to avoid overwhelming DB
                    await delay(500)
                }
            } catch (countyError) {
                console.error(`Error processing county:`, countyError)
                errorCount++
                continue // Skip this county and continue
            }
        }

        // Insert remaining counties
        if (countyData.length > 0) {
            console.log(
                `Inserting final batch (${countyData.length} counties)...`
            )
            try {
                const { error } = await supabaseAdmin
                    .from(tableName)
                    .insert(countyData)
                if (error) {
                    console.error('Final batch insert error:', error)
                    errorCount += countyData.length
                }
            } catch (insertError) {
                console.error('Final insert exception:', insertError)
                errorCount += countyData.length
            }
        }

        console.log(
            `✓ Completed: ${processedCount} counties processed, ${errorCount} errors`
        )
        return processedCount
    } catch (error) {
        console.error('Error generating county data:', error)
        throw error
    }
}

function getBounds(geometry: any) {
    let minLat = Infinity,
        maxLat = -Infinity
    let minLng = Infinity,
        maxLng = -Infinity

    const processCoords = (coords: any): void => {
        if (typeof coords[0] === 'number') {
            minLng = Math.min(minLng, coords[0])
            maxLng = Math.max(maxLng, coords[0])
            minLat = Math.min(minLat, coords[1])
            maxLat = Math.max(maxLat, coords[1])
        } else {
            coords.forEach(processCoords)
        }
    }

    if (geometry.type === 'Polygon') {
        geometry.coordinates.forEach(processCoords)
    } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((polygon: any) =>
            polygon.forEach(processCoords)
        )
    }

    return {
        north: maxLat,
        south: minLat,
        east: maxLng,
        west: minLng
    }
}

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

function estimateCountyPopulation(): number {
    // Random estimate between 10k and 500k
    return Math.floor(Math.random() * 490000) + 10000
}

function calculateNeedScore(population: number, chargerCount: number): number {
    const trafficScore = population / 100000
    return population / 10000 + trafficScore * 2 - chargerCount * 5
}

function calculateWeightedEVScore(
    weightedChargerCount: number,
    population: number
): number {
    const chargersPerCapita = (weightedChargerCount / population) * 100000

    let score: number
    if (chargersPerCapita >= 60) {
        score = 80 + Math.min(((chargersPerCapita - 60) / 40) * 20, 20)
    } else if (chargersPerCapita >= 40) {
        score = 70 + ((chargersPerCapita - 40) / 20) * 10
    } else if (chargersPerCapita >= 25) {
        score = 55 + ((chargersPerCapita - 25) / 15) * 15
    } else if (chargersPerCapita >= 15) {
        score = 40 + ((chargersPerCapita - 15) / 10) * 15
    } else if (chargersPerCapita >= 8) {
        score = 25 + ((chargersPerCapita - 8) / 7) * 15
    } else {
        score = (chargersPerCapita / 8) * 25
    }

    return Math.round(Math.min(100, Math.max(0, score)))
}
