import { supabaseAdmin } from './supabase'
import { calculateNeedScore } from './scoring'
import { fetchStatePopulation } from './census-api'

// Calculate weighted EV score
export function calculateWeightedEVScore(
    weightedChargerCount: number,
    population: number
): number {
    if (!population || population === 0) return 0
    
    const chargersPerCapita = weightedChargerCount / population
    const baseScore = Math.min(100, chargersPerCapita * 50000)
    
    // Bonus for high charger counts
    const countBonus = Math.min(20, weightedChargerCount / 10)
    
    return Math.round(Math.min(100, baseScore + countBonus))
}

export async function generateStateDataOptimized(
    useStaging: boolean = false
): Promise<number> {
    console.log('🚀 Generating state-level data (OPTIMIZED)...')
    const startTime = Date.now()

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

    try {
        // Clear existing data
        console.log(`Clearing ${tableName}...`)
        await supabaseAdmin
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000')

        // OPTIMIZATION: Get all charger counts in a single query!
        console.log('📊 Fetching all state charger counts in ONE query...')
        
        // Fetch ALL rows by using range (Supabase default is 1000)
        const { data: chargerCounts, error } = await supabaseAdmin
            .from(stationsTable)
            .select('state, charger_type_detailed, ev_connector_types, num_ports')
            .order('state')
            .range(0, 999999) // Ensure we get all stations

        if (error) throw error

        // Build maps for charger types, connector types, and port counts
        const stateChargerMap: Record<string, Record<string, number>> = {}
        const stateConnectorMap: Record<string, { tesla: number, ccs: number, j1772: number, chademo: number }> = {}
        const statePortMap: Record<string, { tesla: number, ccs: number, j1772: number, chademo: number, total: number }> = {}
        
        for (const row of chargerCounts || []) {
            if (!stateChargerMap[row.state]) {
                stateChargerMap[row.state] = { dcfast: 0, level2: 0, level1: 0 }
                stateConnectorMap[row.state] = { tesla: 0, ccs: 0, j1772: 0, chademo: 0 }
                statePortMap[row.state] = { tesla: 0, ccs: 0, j1772: 0, chademo: 0, total: 0 }
            }
            
            const numPorts = row.num_ports || 1 // Default to 1 if no port count
            
            // Count charger levels
            stateChargerMap[row.state][row.charger_type_detailed]++
            
            // Count connector types and ports (each station counted once per category)
            const connectorTypes = row.ev_connector_types || []
            
            // Add to total port count
            statePortMap[row.state].total += numPorts
            
            if (connectorTypes.includes('TESLA')) {
                stateConnectorMap[row.state].tesla++
                statePortMap[row.state].tesla += numPorts
            }
            // For non-Tesla: count station if it has ANY non-Tesla connector
            const hasNonTesla = connectorTypes.some((type: string) => 
                ['J1772COMBO', 'J1772', 'CHADEMO'].includes(type)
            )
            if (hasNonTesla) {
                stateConnectorMap[row.state].ccs++
                statePortMap[row.state].ccs += numPorts
            }
            // Keep individual counts for reference
            if (connectorTypes.includes('J1772') && !connectorTypes.includes('J1772COMBO')) {
                stateConnectorMap[row.state].j1772++
                statePortMap[row.state].j1772 += numPorts
            }
            if (connectorTypes.includes('CHADEMO')) {
                stateConnectorMap[row.state].chademo++
                statePortMap[row.state].chademo += numPorts
            }
        }

        console.log(`✅ Got charger data for ${Object.keys(stateChargerMap).length} states`)
        console.log('📍 States with chargers:', Object.keys(stateChargerMap).sort().join(', '))

        // Process states with population data
        const stateData = []
        console.log('🌐 Fetching population data for all states...')

        for (const state of states) {
            const chargers = stateChargerMap[state.code] || { dcfast: 0, level2: 0, level1: 0 }
            const connectors = stateConnectorMap[state.code] || { tesla: 0, ccs: 0, j1772: 0, chademo: 0 }
            const ports = statePortMap[state.code] || { tesla: 0, ccs: 0, j1772: 0, chademo: 0, total: 0 }
            
            const dcFast = chargers.dcfast || 0
            const level2 = chargers.level2 || 0
            const level1 = chargers.level1 || 0
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
                tesla_count: connectors.tesla,
                ccs_count: connectors.ccs,
                j1772_count: connectors.j1772,
                chademo_count: connectors.chademo,
                tesla_ports: ports.tesla,
                ccs_ports: ports.ccs,
                j1772_ports: ports.j1772,
                chademo_ports: ports.chademo,
                total_ports: ports.total,
                need_score: needScore,
                ev_infrastructure_score: score,
                zoom_range: '0-4'
            })
        }

        // Batch insert
        console.log(`💾 Inserting ${stateData.length} states...`)
        const { error: insertError } = await supabaseAdmin
            .from(tableName)
            .insert(stateData)

        if (insertError) throw insertError

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log(`✅ State generation complete in ${duration} seconds (was ~30s)`)
        
        return stateData.length
    } catch (error) {
        console.error('State generation failed:', error)
        throw error
    }
}