import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CENSUS_API_KEY = process.env.CENSUS_API_KEY

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

// Fetch population from Census API with retry
async function fetchPopulation(zipCode, retries = 3) {
    if (!CENSUS_API_KEY) {
        console.warn('No Census API key found, using default population')
        return 10000
    }

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(
                `https://api.census.gov/data/2020/dec/pl?get=P1_001N&for=zip%20code%20tabulation%20area:${zipCode}&key=${CENSUS_API_KEY}`
            )

            if (!response.ok) {
                if (i === retries - 1) return 10000 // Default on final failure
                await new Promise((resolve) =>
                    setTimeout(resolve, 1000 * (i + 1))
                ) // Backoff
                continue
            }

            const data = await response.json()

            // Response format: [["P1_001N", "zip code tabulation area"], ["12345", "90210"]]
            if (data && data.length > 1 && data[1][0]) {
                const pop = parseInt(data[1][0])
                return isNaN(pop) ? 10000 : pop
            }

            return 10000 // Default if no data
        } catch (error) {
            if (i === retries - 1) {
                console.warn(`Failed to fetch population for ${zipCode}`)
                return 10000
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
        }
    }

    return 10000
}

async function generateAllZipData() {
    console.log('Loading ZIP boundaries...')
    const geojson = JSON.parse(fs.readFileSync('./zips.geojson', 'utf8'))
    console.log(`Found ${geojson.features.length} ZCTAs`)

    console.log('Fetching all charging stations...')
    let allStations = []
    let from = 0
    const batchSize = 1000

    while (true) {
        const { data: stations, error } = await supabase
            .from('charging_stations')
            .select('*')
            .range(from, from + batchSize - 1)

        if (error) throw error
        if (!stations || stations.length === 0) break

        allStations = allStations.concat(stations)
        console.log(`Fetched ${allStations.length} stations...`)

        if (stations.length < batchSize) break
        from += batchSize
    }

    console.log(
        `Processing ${geojson.features.length} ZIPs with proximity scoring...`
    )

    const zipRecords = []
    let processed = 0

    for (const feature of geojson.features) {
        const zipCode =
            feature.properties.ZCTA5CE20 ||
            feature.properties.GEOID20 ||
            feature.properties.ZCTA5CE10

        if (!zipCode) continue

        // Get center point
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

        // Find nearby chargers
        const nearbyChargers = allStations.filter((station) => {
            const distance = calculateDistance(
                centerLat,
                centerLng,
                station.latitude,
                station.longitude
            )
            return distance <= 15
        })

        const within1mi = nearbyChargers.filter(
            (s) =>
                calculateDistance(
                    centerLat,
                    centerLng,
                    s.latitude,
                    s.longitude
                ) <= 1
        )
        const within5mi = nearbyChargers.filter(
            (s) =>
                calculateDistance(
                    centerLat,
                    centerLng,
                    s.latitude,
                    s.longitude
                ) <= 5
        )
        const within10mi = nearbyChargers.filter(
            (s) =>
                calculateDistance(
                    centerLat,
                    centerLng,
                    s.latitude,
                    s.longitude
                ) <= 10
        )

        const dcfast = nearbyChargers.filter(
            (c) => c.charger_type_detailed === 'dcfast'
        ).length
        const level2 = nearbyChargers.filter(
            (c) => c.charger_type_detailed === 'level2'
        ).length
        const level1 = nearbyChargers.filter(
            (c) => c.charger_type_detailed === 'level1'
        ).length

        // Calculate score
        let score = 0
        if (within10mi.length > 0) score += 20
        score += Math.min(within1mi.length * 3, 30)
        score += Math.min(within5mi.length * 1, 20)
        const dcfastWithin10 = within10mi.filter(
            (c) => c.charger_type_detailed === 'dcfast'
        ).length
        score += Math.min(dcfastWithin10 * 2, 15)
        if (within1mi.length > 0) {
            score += 10
        } else if (within5mi.length > 0) {
            score += 5
        }
        score = Math.min(Math.round(score), 100)

        const state = nearbyChargers[0]?.state || 'US'

        // Fetch real population from Census API
        const population = await fetchPopulation(zipCode)

        zipRecords.push({
            zip_code: zipCode,
            state: state,
            center_lat: centerLat,
            center_lng: centerLng,
            population: population,
            charger_count: nearbyChargers.length,
            level1_count: level1,
            level2_count: level2,
            dcfast_count: dcfast,
            need_score: 0,
            ev_infrastructure_score: score,
            zoom_range: '9-11'
        })

        processed++
        if (processed % 100 === 0) {
            console.log(
                `Processed ${processed}/${geojson.features.length} ZIPs...`
            )
        }
    }

    console.log(`Clearing existing zip data...`)
    await supabase
        .from('zip_level_data')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

    console.log(`Inserting ${zipRecords.length} ZIP records...`)
    const insertBatchSize = 500
    for (let i = 0; i < zipRecords.length; i += insertBatchSize) {
        const batch = zipRecords.slice(i, i + insertBatchSize)
        const { error } = await supabase.from('zip_level_data').insert(batch)

        if (error) {
            console.error('Batch insert error:', error)
            throw error
        }

        console.log(
            `Inserted ${Math.min(i + insertBatchSize, zipRecords.length)}/${
                zipRecords.length
            }...`
        )
    }

    console.log(
        `✓ Complete! Generated ${zipRecords.length} ZIP records with real population data`
    )
}

generateAllZipData().catch(console.error)
