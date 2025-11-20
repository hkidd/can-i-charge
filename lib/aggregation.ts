import { supabaseAdmin } from './supabase'
import { calculateDistance } from './scoring'
import { calculateNeedScore } from './scoring'
import {
    estimateNeighborhoodPopulation,
    fetchStatePopulation
} from './census-api'

interface ChargingStation {
    latitude: number
    longitude: number
    charger_type: string
}

// Generate neighborhood grid cells (2mi x 2mi grid across US)
export async function generateNeighborhoodData(): Promise<number> {
    console.log('Generating neighborhood-level data...')

    // US bounding box
    const bounds = {
        minLat: 24.5,
        maxLat: 49.4,
        minLng: -125,
        maxLng: -66.9
    }

    // Grid size: ~2 miles = 0.029 degrees latitude
    const gridSize = 0.029
    let inserted = 0

    // Fetch all charging stations
    const { data: stations } = await supabaseAdmin
        .from('charging_stations')
        .select('latitude, longitude, charger_type')

    if (!stations) {
        throw new Error('Failed to fetch charging stations')
    }

    const neighborhoods = []

    // Generate grid
    for (let lat = bounds.minLat; lat < bounds.maxLat; lat += gridSize) {
        for (let lng = bounds.minLng; lng < bounds.maxLng; lng += gridSize) {
            const centerLat = lat + gridSize / 2
            const centerLng = lng + gridSize / 2

            // Count nearby chargers (within ~3 miles)
            const nearbyChargers = stations.filter((s: ChargingStation) => {
                const distance = calculateDistance(
                    centerLat,
                    centerLng,
                    s.latitude,
                    s.longitude
                )
                return distance <= 3
            })

            // Skip empty grid cells
            if (nearbyChargers.length === 0) continue

            // Count chargers at different distances
            const within1mi = nearbyChargers.filter(
                (s: ChargingStation) =>
                    calculateDistance(
                        centerLat,
                        centerLng,
                        s.latitude,
                        s.longitude
                    ) <= 1
            ).length

            const within5mi = stations.filter(
                (s: ChargingStation) =>
                    calculateDistance(
                        centerLat,
                        centerLng,
                        s.latitude,
                        s.longitude
                    ) <= 5
            ).length

            const within10mi = stations.filter(
                (s: ChargingStation) =>
                    calculateDistance(
                        centerLat,
                        centerLng,
                        s.latitude,
                        s.longitude
                    ) <= 10
            ).length

            const fastChargers = nearbyChargers.filter(
                (s: ChargingStation) => s.charger_type === 'dcfast'
            ).length

            // Calculate EV Infrastructure Score
            const score = Math.min(
                20 + // Base score
                    within1mi * 3 +
                    Math.min(within5mi, 20) +
                    fastChargers * 2,
                100
            )

            const population = estimateNeighborhoodPopulation()
            const needScore = calculateNeedScore(
                population,
                nearbyChargers.length
            )

            neighborhoods.push({
                area_id: `${centerLat.toFixed(4)}_${centerLng.toFixed(4)}`,
                name: `Grid ${centerLat.toFixed(2)}, ${centerLng.toFixed(2)}`,
                center_lat: centerLat,
                center_lng: centerLng,
                population,
                charger_count: nearbyChargers.length,
                need_score: needScore,
                ev_infrastructure_score: score,
                chargers_within_1mi: within1mi,
                chargers_within_5mi: within5mi,
                chargers_within_10mi: within10mi,
                fast_charger_ratio:
                    nearbyChargers.length > 0
                        ? fastChargers / nearbyChargers.length
                        : 0,
                highway_proximity_score: 0,
                zoom_range: '13-22'
            })

            // Batch insert every 1000 neighborhoods
            if (neighborhoods.length >= 1000) {
                const { error } = await supabaseAdmin
                    .from('neighborhood_level_data')
                    .insert(neighborhoods)

                if (error) {
                    console.error('Error inserting neighborhoods:', error)
                } else {
                    inserted += neighborhoods.length
                    console.log(`Inserted ${inserted} neighborhoods so far...`)
                }

                neighborhoods.length = 0 // Clear array
            }
        }
    }

    // Insert remaining neighborhoods
    if (neighborhoods.length > 0) {
        const { error } = await supabaseAdmin
            .from('neighborhood_level_data')
            .insert(neighborhoods)

        if (!error) {
            inserted += neighborhoods.length
        }
    }

    console.log(`Completed: ${inserted} neighborhoods`)
    return inserted
}

// Simplified state-level aggregation
export async function generateStateData(
    useStaging: boolean = false
): Promise<number> {
    console.log('Generating state-level data...')

    const tableName = useStaging
        ? 'state_level_data_staging'
        : 'state_level_data'
    const stationsTable = 'charging_stations' // Always use production charging_stations table

    const states = [
        { code: 'AL', name: 'Alabama', lat: 32.806671, lng: -86.79113 },
        { code: 'AK', name: 'Alaska', lat: 61.370716, lng: -152.404419 },
        { code: 'AZ', name: 'Arizona', lat: 33.729759, lng: -111.431221 },
        { code: 'AR', name: 'Arkansas', lat: 34.969704, lng: -92.373123 },
        { code: 'CA', name: 'California', lat: 36.778259, lng: -119.417931 },
        { code: 'CO', name: 'Colorado', lat: 39.059811, lng: -105.311104 },
        { code: 'CT', name: 'Connecticut', lat: 41.597782, lng: -72.755371 },
        { code: 'DE', name: 'Delaware', lat: 39.318523, lng: -75.507141 },
        { code: 'FL', name: 'Florida', lat: 27.766279, lng: -81.686783 },
        { code: 'GA', name: 'Georgia', lat: 33.040619, lng: -83.643074 },
        { code: 'HI', name: 'Hawaii', lat: 21.094318, lng: -157.498337 },
        { code: 'ID', name: 'Idaho', lat: 44.240459, lng: -114.478828 },
        { code: 'IL', name: 'Illinois', lat: 40.349457, lng: -88.986137 },
        { code: 'IN', name: 'Indiana', lat: 39.849426, lng: -86.258278 },
        { code: 'IA', name: 'Iowa', lat: 42.011539, lng: -93.210526 },
        { code: 'KS', name: 'Kansas', lat: 38.5266, lng: -96.726486 },
        { code: 'KY', name: 'Kentucky', lat: 37.66814, lng: -84.670067 },
        { code: 'LA', name: 'Louisiana', lat: 31.169546, lng: -91.867805 },
        { code: 'ME', name: 'Maine', lat: 44.693947, lng: -69.381927 },
        { code: 'MD', name: 'Maryland', lat: 39.063946, lng: -76.802101 },
        { code: 'MA', name: 'Massachusetts', lat: 42.230171, lng: -71.530106 },
        { code: 'MI', name: 'Michigan', lat: 43.326618, lng: -84.536095 },
        { code: 'MN', name: 'Minnesota', lat: 45.694454, lng: -93.900192 },
        { code: 'MS', name: 'Mississippi', lat: 32.741646, lng: -89.678696 },
        { code: 'MO', name: 'Missouri', lat: 38.456085, lng: -92.288368 },
        { code: 'MT', name: 'Montana', lat: 46.921925, lng: -110.454353 },
        { code: 'NE', name: 'Nebraska', lat: 41.12537, lng: -98.268082 },
        { code: 'NV', name: 'Nevada', lat: 38.313515, lng: -117.055374 },
        { code: 'NH', name: 'New Hampshire', lat: 43.452492, lng: -71.563896 },
        { code: 'NJ', name: 'New Jersey', lat: 40.298904, lng: -74.521011 },
        { code: 'NM', name: 'New Mexico', lat: 34.840515, lng: -106.248482 },
        { code: 'NY', name: 'New York', lat: 42.165726, lng: -74.948051 },
        { code: 'NC', name: 'North Carolina', lat: 35.630066, lng: -79.806419 },
        { code: 'ND', name: 'North Dakota', lat: 47.528912, lng: -99.784012 },
        { code: 'OH', name: 'Ohio', lat: 40.388783, lng: -82.764915 },
        { code: 'OK', name: 'Oklahoma', lat: 35.565342, lng: -96.928917 },
        { code: 'OR', name: 'Oregon', lat: 44.572021, lng: -122.070938 },
        { code: 'PA', name: 'Pennsylvania', lat: 40.590752, lng: -77.209755 },
        { code: 'RI', name: 'Rhode Island', lat: 41.680893, lng: -71.51178 },
        { code: 'SC', name: 'South Carolina', lat: 33.856892, lng: -80.945007 },
        { code: 'SD', name: 'South Dakota', lat: 44.299782, lng: -99.438828 },
        { code: 'TN', name: 'Tennessee', lat: 35.747845, lng: -86.692345 },
        { code: 'TX', name: 'Texas', lat: 31.054487, lng: -97.563461 },
        { code: 'UT', name: 'Utah', lat: 40.150032, lng: -111.862434 },
        { code: 'VT', name: 'Vermont', lat: 44.045876, lng: -72.710686 },
        { code: 'VA', name: 'Virginia', lat: 37.769337, lng: -78.169968 },
        { code: 'WA', name: 'Washington', lat: 47.400902, lng: -121.490494 },
        { code: 'WV', name: 'West Virginia', lat: 38.491226, lng: -80.954453 },
        { code: 'WI', name: 'Wisconsin', lat: 44.268543, lng: -89.616508 },
        { code: 'WY', name: 'Wyoming', lat: 42.755966, lng: -107.30249 }
    ]

    const stateData = []

    for (const state of states) {
        // Count each charger type separately
        const { count: dcfastCount } = await supabaseAdmin
            .from(stationsTable)
            .select('*', { count: 'exact', head: true })
            .eq('state', state.code)
            .eq('charger_type_detailed', 'dcfast')

        const { count: level2Count } = await supabaseAdmin
            .from(stationsTable)
            .select('*', { count: 'exact', head: true })
            .eq('state', state.code)
            .eq('charger_type_detailed', 'level2')

        const { count: level1Count } = await supabaseAdmin
            .from(stationsTable)
            .select('*', { count: 'exact', head: true })
            .eq('state', state.code)
            .eq('charger_type_detailed', 'level1')

        const dcFast = dcfastCount || 0
        const level2 = level2Count || 0
        const level1 = level1Count || 0
        const totalChargers = dcFast + level2 + level1

        const population = await fetchStatePopulation(state.code)
        const needScore = calculateNeedScore(population, totalChargers)

        // Weighted scoring: DC Fast = 1.0x, Level 2 = 0.7x, Level 1 = 0.3x
        const weightedChargerCount = dcFast * 1.0 + level2 * 0.7 + level1 * 0.3
        const score = calculateWeightedEVScore(weightedChargerCount, population)

        stateData.push({
            state_name: state.name,
            center_lat: state.lat,
            center_lng: state.lng,
            population,
            charger_count: totalChargers,
            level1_count: level1,
            level2_count: level2,
            dcfast_count: dcFast,
            need_score: needScore,
            ev_infrastructure_score: score,
            zoom_range: '0-4'
        })
    }

    const { error } = await supabaseAdmin.from(tableName).insert(stateData)

    if (error) {
        console.error('Error inserting states:', error)
        return 0
    }

    console.log(`Completed: ${stateData.length} states`)
    return stateData.length
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
