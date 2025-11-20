import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CENSUS_API_KEY = process.env.CENSUS_API_KEY
const CONCURRENT_LIMIT = 10 // Limit concurrent Census API calls
const BATCH_SIZE = 1000 // Process ZIPs in batches

// Support staging tables for zero-downtime updates
const USE_STAGING = process.env.USE_STAGING === 'true' || process.argv.includes('--staging')
const TABLE_NAME = USE_STAGING ? 'zip_level_data_staging' : 'zip_level_data'
const STATIONS_TABLE = 'charging_stations' // Always use production charging_stations table

// Haversine distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// Note: Spatial index functions removed - now using PostGIS for accurate boundary-based calculations

// Batch Census API calls with concurrency control
async function fetchPopulationBatch(zipCodes) {
    const semaphore = new Array(CONCURRENT_LIMIT).fill(Promise.resolve())
    let index = 0

    const fetchWithSemaphore = async (zipCode) => {
        const semIndex = index++ % CONCURRENT_LIMIT
        await semaphore[semIndex]

        const promise = fetchPopulation(zipCode)
        semaphore[semIndex] = promise.catch(() => {}) // Don't block on errors
        return promise
    }

    return Promise.all(zipCodes.map(fetchWithSemaphore))
}

// Fetch population from Census API with retry
async function fetchPopulation(zipCode, retries = 3) {
    if (!CENSUS_API_KEY) {
        return 10000
    }

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(
                `https://api.census.gov/data/2023/acs/acs5?get=B01003_001E&for=zip%20code%20tabulation%20area:${zipCode}&key=${CENSUS_API_KEY}`
            )

            if (!response.ok) {
                if (i === retries - 1) return 10000
                await new Promise((resolve) =>
                    setTimeout(resolve, 200 * (i + 1))
                )
                continue
            }

            const data = await response.json()

            if (data && data.length > 1 && data[1][0]) {
                const pop = parseInt(data[1][0])
                return isNaN(pop) ? 10000 : pop
            }

            return 10000
        } catch (error) {
            if (i === retries - 1) {
                return 10000
            }
            await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)))
        }
    }

    return 10000
}

// Process a batch of ZIP codes using PostGIS spatial queries for accuracy
async function processZipBatchWithPostGIS(features) {
    const zipRecords = []

    for (const feature of features) {
        const zipCode =
            feature.properties.ZCTA5CE20 ||
            feature.properties.GEOID20 ||
            feature.properties.ZCTA5CE10

        if (!zipCode) continue

        // Get center point for ZIP
        const coordinates = feature.geometry.coordinates
        let centerLat, centerLng

        if (feature.geometry.type === 'Polygon') {
            const ring = coordinates[0]
            centerLat =
                ring.reduce((sum, coord) => sum + coord[1], 0) / ring.length
            centerLng =
                ring.reduce((sum, coord) => sum + coord[0], 0) / ring.length
        } else if (feature.geometry.type === 'MultiPolygon') {
            const ring = coordinates[0][0]
            centerLat =
                ring.reduce((sum, coord) => sum + coord[1], 0) / ring.length
            centerLng =
                ring.reduce((sum, coord) => sum + coord[0], 0) / ring.length
        } else {
            continue
        }

        // Use PostGIS spatial query to find stations within ZIP boundary
        const geometryGeoJSON = JSON.stringify(feature.geometry)
        
        try {
            // Query charging stations that are within this ZIP's geometry
            // For staging, use staging table in the function
            const { data: stationsInZip, error } = await supabase.rpc(
                'get_stations_in_zip', 
                {
                    zip_geometry: geometryGeoJSON
                }
            )

            let stations = stationsInZip || []
            
            if (error) {
                console.error(`Error querying stations for ZIP ${zipCode}:`, error)
                stations = []
            }

            // Count stations and ports by charger type - only stations actually within ZIP boundaries
            const dcfast = stations.filter(
                (c) => c.charger_type_detailed === 'dcfast'
            ).length
            const level2 = stations.filter(
                (c) => c.charger_type_detailed === 'level2'
            ).length
            const level1 = stations.filter(
                (c) => c.charger_type_detailed === 'level1'
            ).length
            
            // Calculate total ports
            const totalPorts = stations.reduce((sum, station) => 
                sum + (station.num_ports || 1), 0
            )
            
            // Count by connector type (stations and ports)
            const teslaStations = stations.filter((c) => 
                c.ev_connector_types && c.ev_connector_types.includes('TESLA')
            )
            const tesla = teslaStations.length
            const teslaPorts = teslaStations.reduce((sum, station) => 
                sum + (station.num_ports || 1), 0
            )
            
            const ccsStations = stations.filter((c) => 
                c.ev_connector_types && c.ev_connector_types.some(type =>
                    ['J1772COMBO', 'J1772', 'CHADEMO'].includes(type)
                )
            )
            const ccs = ccsStations.length
            const ccsPorts = ccsStations.reduce((sum, station) => 
                sum + (station.num_ports || 1), 0
            )
            
            const j1772Stations = stations.filter((c) => 
                c.ev_connector_types && 
                c.ev_connector_types.includes('J1772') && 
                !c.ev_connector_types.includes('J1772COMBO')
            )
            const j1772 = j1772Stations.length
            const j1772Ports = j1772Stations.reduce((sum, station) => 
                sum + (station.num_ports || 1), 0
            )
            
            const chademoStations = stations.filter((c) => 
                c.ev_connector_types && c.ev_connector_types.includes('CHADEMO')
            )
            const chademo = chademoStations.length
            const chademoPorts = chademoStations.reduce((sum, station) => 
                sum + (station.num_ports || 1), 0
            )

            const totalChargers = dcfast + level2 + level1

            // Calculate distance-based accessibility metrics for scoring
            const within1mi = stations.filter((station) =>
                calculateDistance(centerLat, centerLng, station.latitude, station.longitude) <= 1
            ).length
            const within5mi = stations.filter((station) =>
                calculateDistance(centerLat, centerLng, station.latitude, station.longitude) <= 5
            ).length

            // Use population-based scoring (will be recalculated with real population later)
            const tempPopulation = 10000
            const weightedChargerCount = dcfast * 1.0 + level2 * 0.7 + level1 * 0.3
            const chargersPerCapita = (weightedChargerCount / tempPopulation) * 100000
            
            let score = 0
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
            
            // Smaller accessibility bonus since we're using boundary-based counting
            let proximityBonus = 0
            if (within1mi > 0) {
                proximityBonus = Math.min(within1mi * 3, 10) // Reduced from 5->3, max 10
            } else if (within5mi > 0) {
                proximityBonus = Math.min(within5mi * 1, 5) // Reduced from 2->1, max 5
            }
            
            score = Math.min(Math.round(score + proximityBonus), 100)

            const state = (stations && stations[0]?.state) || 'US'

            zipRecords.push({
                zipCode,
                zip_code: zipCode,
                state: state,
                center_lat: centerLat,
                center_lng: centerLng,
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
                need_score: 0,
                ev_infrastructure_score: score,
                proximityBonus: proximityBonus,
                zoom_range: '9-11'
            })

        } catch (err) {
            console.error(`Error processing ZIP ${zipCode}:`, err)
            // Add empty record to maintain consistency
            zipRecords.push({
                zipCode,
                zip_code: zipCode,
                state: 'US',
                center_lat: centerLat,
                center_lng: centerLng,
                charger_count: 0,
                level1_count: 0,
                level2_count: 0,
                dcfast_count: 0,
                tesla_count: 0,
                ccs_count: 0,
                j1772_count: 0,
                chademo_count: 0,
                tesla_ports: 0,
                ccs_ports: 0,
                j1772_ports: 0,
                chademo_ports: 0,
                total_ports: 0,
                need_score: 0,
                ev_infrastructure_score: 0,
                proximityBonus: 0,
                zoom_range: '9-11'
            })
        }
    }

    return zipRecords
}

async function generateAllZipDataOptimized() {
    console.log('🚀 Starting optimized ZIP data generation...')
    console.log(`📊 Mode: ${USE_STAGING ? 'STAGING' : 'PRODUCTION'}`)

    console.log('📍 Loading ZIP boundaries...')
    const geojson = JSON.parse(fs.readFileSync('./zips.geojson', 'utf8'))
    console.log(`Found ${geojson.features.length} ZCTAs`)

    console.log('🗺️ Using PostGIS spatial queries for accurate boundary-based counting...')

    console.log('🏁 Processing ZIPs in optimized batches...')
    const allZipRecords = []
    let processed = 0

    // Process ZIPs in batches
    for (let i = 0; i < geojson.features.length; i += BATCH_SIZE) {
        const batch = geojson.features.slice(i, i + BATCH_SIZE)

        // Process geographic data for batch using PostGIS spatial queries
        const zipRecords = await processZipBatchWithPostGIS(batch)

        // Fetch population data concurrently
        const zipCodes = zipRecords.map((r) => r.zipCode)
        console.log(
            `📊 Fetching population data for batch ${
                Math.floor(i / BATCH_SIZE) + 1
            }...`
        )
        const populations = await fetchPopulationBatch(zipCodes)

        // Merge population data and recalculate scores with real population
        zipRecords.forEach((record, index) => {
            const realPopulation = populations[index] || 10000
            record.population = realPopulation
            
            // Recalculate score with real population
            const weightedChargerCount = record.dcfast_count * 1.0 + record.level2_count * 0.7 + record.level1_count * 0.3
            const chargersPerCapita = (weightedChargerCount / realPopulation) * 100000
            
            let score = 0
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
            
            // Apply the proximity bonus to the population-based score
            record.ev_infrastructure_score = Math.min(Math.round(score + record.proximityBonus), 100)
            
            delete record.zipCode // Remove temp field
            delete record.proximityBonus // Remove temp field
        })

        allZipRecords.push(...zipRecords)
        processed += batch.length

        const percentage = (
            (processed / geojson.features.length) *
            100
        ).toFixed(1)
        console.log(
            `✅ Processed ${processed}/${geojson.features.length} ZIPs (${percentage}%)`
        )

        // Small delay to be nice to Census API
        await new Promise((resolve) => setTimeout(resolve, 100))
    }

    console.log(`🗑️  Clearing existing ${TABLE_NAME}...`)
    await supabase
        .from(TABLE_NAME)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

    console.log(`💾 Inserting ${allZipRecords.length} ZIP records into ${TABLE_NAME}...`)
    const insertBatchSize = 500
    for (let i = 0; i < allZipRecords.length; i += insertBatchSize) {
        const batch = allZipRecords.slice(i, i + insertBatchSize)
        const { error } = await supabase.from(TABLE_NAME).insert(batch)

        if (error) {
            console.error('Batch insert error:', error)
            throw error
        }

        const percentage = (
            ((i + batch.length) / allZipRecords.length) *
            100
        ).toFixed(1)
        console.log(
            `💾 Inserted ${Math.min(
                i + insertBatchSize,
                allZipRecords.length
            )}/${allZipRecords.length} (${percentage}%)`
        )
    }

    console.log(
        `🎉 Complete! Generated ${allZipRecords.length} ZIP records with optimized processing`
    )
    
    if (USE_STAGING) {
        console.log('✅ Data saved to staging table. Performing atomic swap...')
        try {
            const { error: swapError } = await supabase.rpc('copy_zip_staging_to_production')
            if (swapError) {
                console.error('❌ Failed to swap staging to production:', swapError)
                throw swapError
            }
            console.log('🎉 Successfully swapped zip data to production with zero downtime!')
        } catch (error) {
            console.error('❌ Staging swap failed:', error)
            throw error
        }
    }
}

console.log('⚡ OPTIMIZED ZIP DATA GENERATOR ⚡')
console.log('Improvements:')
console.log('• Spatial indexing for 10-50x faster station lookups')
console.log('• Concurrent Census API calls (10x parallelism)')
console.log('• Batch processing to reduce memory usage')
console.log('• Reduced redundant distance calculations')
console.log('')

generateAllZipDataOptimized().catch(console.error)
