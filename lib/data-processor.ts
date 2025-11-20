import { supabaseAdmin } from './supabase'

export interface NRELStation {
    id: number
    station_name: string
    latitude: number
    longitude: number
    street_address: string
    city: string
    state: string
    zip: string
    ev_connector_types: string[]
    ev_dc_fast_num?: number
    ev_level1_evse_num?: number
    ev_level2_evse_num?: number
    ev_network?: string
}

export interface ProcessedStation {
    name: string
    latitude: number
    longitude: number
    address: string
    zip: string
    num_ports: number
    charger_type: 'level1' | 'level2' | 'dcfast'
    charger_type_detailed: 'level1' | 'level2' | 'dcfast'
    ev_connector_types: string[]
    network: string
    state: string
}

export function processNRELStation(station: NRELStation): ProcessedStation {
    // Determine most powerful charger type available
    const hasDCFast =
        (station.ev_dc_fast_num && station.ev_dc_fast_num > 0) ||
        station.ev_connector_types?.some(
            (type) => type.includes('DCFAST') || type.includes('TESLA')
        )

    const hasLevel2 =
        station.ev_level2_evse_num && station.ev_level2_evse_num > 0
    const hasLevel1 =
        station.ev_level1_evse_num && station.ev_level1_evse_num > 0

    // Classify by most powerful type available
    let chargerType: 'level1' | 'level2' | 'dcfast'
    let numPorts: number

    if (hasDCFast) {
        chargerType = 'dcfast'
        numPorts = station.ev_dc_fast_num || 1
    } else if (hasLevel2) {
        chargerType = 'level2'
        numPorts = station.ev_level2_evse_num || 1
    } else {
        chargerType = 'level1'
        numPorts = station.ev_level1_evse_num || 1
    }

    const fullAddress = `${station.street_address}, ${station.city}, ${station.state} ${station.zip}`

    return {
        name: station.station_name,
        latitude: station.latitude,
        longitude: station.longitude,
        address: fullAddress,
        zip: station.zip,
        num_ports: numPorts,
        charger_type: chargerType,
        charger_type_detailed: chargerType,
        ev_connector_types: station.ev_connector_types || [],
        network: station.ev_network || 'Unknown',
        state: station.state
    }
}

export async function batchInsertStations(
    stations: ProcessedStation[],
    batchSize: number = 1000,
    useStaging: boolean = false // NEW: support staging
): Promise<{ inserted: number; errors: number }> {
    let inserted = 0
    let errors = 0

    const tableName = useStaging
        ? 'charging_stations_staging'
        : 'charging_stations'

    for (let i = 0; i < stations.length; i += batchSize) {
        const batch = stations.slice(i, i + batchSize)

        try {
            const { error } = await supabaseAdmin.from(tableName).insert(batch)

            if (error) {
                console.error(`Batch ${i / batchSize + 1} error:`, error)
                errors += batch.length
            } else {
                inserted += batch.length
                console.log(
                    `Inserted batch ${i / batchSize + 1}: ${
                        batch.length
                    } stations into ${tableName}`
                )
            }
        } catch (err) {
            console.error(`Batch ${i / batchSize + 1} failed:`, err)
            errors += batch.length
        }

        if (i + batchSize < stations.length) {
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
    }

    return { inserted, errors }
}

export async function clearTable(tableName: string): Promise<boolean> {
    try {
        const { error } = await supabaseAdmin
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000')

        if (error) {
            console.error(`Failed to clear ${tableName}:`, error)
            return false
        }

        return true
    } catch (err) {
        console.error(`Clear operation failed for ${tableName}:`, err)
        return false
    }
}

export async function clearChargingStations(): Promise<boolean> {
    return clearTable('charging_stations')
}

// NEW: Swap staging tables to production
export async function swapStagingToProduction(): Promise<boolean> {
    try {
        console.log('Starting atomic swap from staging to production...')

        // Use the new SECURITY DEFINER function
        const { error } = await supabaseAdmin.rpc('copy_staging_to_production')

        if (error) {
            console.error('Swap failed:', error)
            return false
        }

        console.log('Successfully swapped staging to production with zero downtime')
        return true
    } catch (err) {
        console.error('Swap operation failed:', err)
        return false
    }
}
