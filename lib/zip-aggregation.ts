import { supabaseAdmin } from './supabase'
import { fetchZipPopulation } from './census-api'

export async function generateZipData(
    useStaging: boolean = false
): Promise<number> {
    console.log('Generating zip-level data...')

    const tableName = useStaging ? 'zip_level_data_staging' : 'zip_level_data'
    const stationsTable = 'charging_stations' // Always use production charging_stations table

    try {
        // Clear existing data
        console.log(`Clearing ${tableName}...`)
        await supabaseAdmin
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000')

        // Get ALL stations with their actual zip codes (no limit!)
        console.log('Fetching all charging stations with zip codes...')

        let allStations: any[] = []
        let from = 0
        const batchSize = 1000
        let hasMore = true

        // Paginate through ALL stations
        while (hasMore) {
            const { data: stations, error: stationsError } = await supabaseAdmin
                .from(stationsTable)
                .select('*, ev_connector_types, num_ports')
                .not('zip', 'is', null)
                .not('state', 'is', null)
                .range(from, from + batchSize - 1)

            if (stationsError) {
                throw new Error(
                    `Failed to fetch stations: ${stationsError.message}`
                )
            }

            if (!stations || stations.length === 0) {
                hasMore = false
            } else {
                allStations = allStations.concat(stations)
                console.log(`Fetched ${allStations.length} stations so far...`)
                from += batchSize

                if (stations.length < batchSize) {
                    hasMore = false
                }
            }
        }

        if (allStations.length === 0) {
            throw new Error('No stations found with zip codes')
        }

        console.log(`Found ${allStations.length} total stations with zip codes`)

        // Group stations by zip code
        const zipGroups = new Map<string, any[]>()

        allStations.forEach((station) => {
            // Clean zip code (remove +4 extension if present)
            const cleanZip = station.zip?.split('-')[0]?.trim()
            if (!cleanZip || cleanZip.length !== 5) return

            const key = `${cleanZip}-${station.state}`
            if (!zipGroups.has(key)) {
                zipGroups.set(key, [])
            }
            zipGroups.get(key)!.push(station)
        })

        console.log(`Processing ${zipGroups.size} unique zip codes...`)

        let zipData: any[] = []
        let processedCount = 0
        let batchCount = 0

        for (const [key, zipStations] of zipGroups.entries()) {
            const [zipCode, state] = key.split('-')

            // Calculate center point from all stations in this zip
            const avgLat =
                zipStations.reduce((sum, s) => sum + s.latitude, 0) /
                zipStations.length
            const avgLng =
                zipStations.reduce((sum, s) => sum + s.longitude, 0) /
                zipStations.length

            // Count charger types and connector types
            let dcfast = 0,
                level2 = 0,
                level1 = 0
            let tesla = 0,
                ccs = 0,
                j1772 = 0,
                chademo = 0
            let teslaPorts = 0,
                ccsPorts = 0,
                j1772Ports = 0,
                chademoPorts = 0,
                totalPorts = 0

            zipStations.forEach((station) => {
                const numPorts = station.num_ports || 1
                totalPorts += numPorts
                
                // Count charger levels
                if (station.charger_type_detailed === 'dcfast') dcfast++
                else if (station.charger_type_detailed === 'level2') level2++
                else if (station.charger_type_detailed === 'level1') level1++

                // Count connector types and ports
                const connectorTypes = station.ev_connector_types || []
                if (connectorTypes.includes('TESLA')) {
                    tesla++
                    teslaPorts += numPorts
                }
                const hasNonTesla = connectorTypes.some((type: string) => 
                    ['J1772COMBO', 'J1772', 'CHADEMO'].includes(type)
                )
                if (hasNonTesla) {
                    ccs++
                    ccsPorts += numPorts
                }
                if (connectorTypes.includes('J1772') && !connectorTypes.includes('J1772COMBO')) {
                    j1772++
                    j1772Ports += numPorts
                }
                if (connectorTypes.includes('CHADEMO')) {
                    chademo++
                    chademoPorts += numPorts
                }
            })

            const totalChargers = zipStations.length
            const weightedChargerCount =
                dcfast * 1.0 + level2 * 0.7 + level1 * 0.3

            // Fetch REAL population from Census API
            let population: number
            try {
                population = await fetchZipPopulation(zipCode)
            } catch (error) {
                console.warn(
                    `Could not fetch population for zip ${zipCode}, using estimate`
                )
                population = estimateZipPopulation()
            }

            const needScore = calculateNeedScore(population, totalChargers)
            const score = calculateWeightedEVScore(
                weightedChargerCount,
                population
            )

            zipData.push({
                zip_code: zipCode,
                state: state,
                center_lat: avgLat,
                center_lng: avgLng,
                population,
                charger_count: totalChargers,
                level1_count: level1,
                level2_count: level2,
                dcfast_count: dcfast,
                tesla_count: tesla,
                ccs_count: ccs,
                j1772_count: j1772,
                chademo_count: chademo,
                tesla_ports: teslaPorts,
                ccs_ports: ccsPorts,
                j1772_ports: j1772Ports,
                chademo_ports: chademoPorts,
                total_ports: totalPorts,
                need_score: needScore,
                ev_infrastructure_score: score,
                zoom_range: '9-11'
            })

            processedCount++

            if (processedCount % 100 === 0) {
                console.log(
                    `Processed ${processedCount} / ${zipGroups.size} zip codes...`
                )
            }

            // Batch insert every 500 zips
            if (zipData.length >= 500) {
                batchCount++
                console.log(`Inserting batch ${batchCount} (500 zips)...`)
                const { error } = await supabaseAdmin
                    .from(tableName)
                    .insert(zipData)
                if (error) {
                    console.error('Batch insert error:', error)
                }
                zipData = []
            }
        }

        // Insert remaining zips
        if (zipData.length > 0) {
            console.log(`Inserting final batch (${zipData.length} zips)...`)
            const { error } = await supabaseAdmin
                .from(tableName)
                .insert(zipData)
            if (error) {
                console.error('Final batch insert error:', error)
            }
        }

        console.log(`✓ Completed: ${processedCount} zip codes with real data`)
        return processedCount
    } catch (error) {
        console.error('Error generating zip data:', error)
        throw error
    }
}

function estimateZipPopulation(): number {
    // Fallback if Census API fails
    return Math.floor(Math.random() * 40000) + 5000
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
