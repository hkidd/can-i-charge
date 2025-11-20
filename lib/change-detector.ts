import { supabaseAdmin } from './supabase'

export interface StationChange {
    station_id: number
    change_type: 'added' | 'removed' | 'modified'
    affected_regions: {
        state: string
        county?: string
        zip?: string
    }
    old_data?: any
    new_data?: any
}

export interface RegionChanges {
    states: Set<string>
    counties: Set<string>
    zips: Set<string>
    total_changes: number
}

/**
 * Detects changes in charging stations and determines which regions need updates
 */
export class ChangeDetector {
    /**
     * Compare current stations with previous data to detect changes
     */
    static async detectChanges(useStaging: boolean = true): Promise<RegionChanges> {
        console.log('🔍 Detecting station changes...')
        
        const currentTable = useStaging ? 'charging_stations_staging' : 'charging_stations'
        const previousTable = useStaging ? 'charging_stations' : 'charging_stations_previous'
        
        // Get current stations (newly fetched)
        const { data: currentStations, error: currentError } = await supabaseAdmin
            .from(currentTable)
            .select('id, name, latitude, longitude, state, zip, charger_type_detailed, ev_connector_types')
            .range(0, 999999)
            
        if (currentError) throw currentError
        
        // Get previous stations (production data)
        const { data: previousStations, error: previousError } = await supabaseAdmin
            .from('charging_stations')
            .select('id, name, latitude, longitude, state, zip, charger_type_detailed, ev_connector_types')
            .range(0, 999999)
            
        if (previousError) throw previousError
        
        // Create maps for efficient lookup
        const currentMap = new Map(currentStations?.map(s => [s.id, s]) || [])
        const previousMap = new Map(previousStations?.map(s => [s.id, s]) || [])
        
        const changes: StationChange[] = []
        const affectedRegions: RegionChanges = {
            states: new Set(),
            counties: new Set(), 
            zips: new Set(),
            total_changes: 0
        }
        
        // Find new stations
        for (const [id, station] of currentMap) {
            if (!previousMap.has(id)) {
                changes.push({
                    station_id: id,
                    change_type: 'added',
                    affected_regions: {
                        state: station.state,
                        zip: station.zip
                    },
                    new_data: station
                })
                
                affectedRegions.states.add(station.state)
                if (station.zip) affectedRegions.zips.add(station.zip)
            }
        }
        
        // Find removed stations
        for (const [id, station] of previousMap) {
            if (!currentMap.has(id)) {
                changes.push({
                    station_id: id,
                    change_type: 'removed',
                    affected_regions: {
                        state: station.state,
                        zip: station.zip
                    },
                    old_data: station
                })
                
                affectedRegions.states.add(station.state)
                if (station.zip) affectedRegions.zips.add(station.zip)
            }
        }
        
        // Find modified stations
        for (const [id, current] of currentMap) {
            const previous = previousMap.get(id)
            if (previous && this.hasSignificantChanges(previous, current)) {
                changes.push({
                    station_id: id,
                    change_type: 'modified',
                    affected_regions: {
                        state: current.state,
                        zip: current.zip
                    },
                    old_data: previous,
                    new_data: current
                })
                
                affectedRegions.states.add(current.state)
                if (current.zip) affectedRegions.zips.add(current.zip)
                
                // If station moved states/zips, mark old ones too
                if (previous.state !== current.state) {
                    affectedRegions.states.add(previous.state)
                }
                if (previous.zip !== current.zip && previous.zip) {
                    affectedRegions.zips.add(previous.zip)
                }
            }
        }
        
        affectedRegions.total_changes = changes.length
        
        console.log(`📊 Change Detection Results:`)
        console.log(`   • ${changes.filter(c => c.change_type === 'added').length} stations added`)
        console.log(`   • ${changes.filter(c => c.change_type === 'removed').length} stations removed`)
        console.log(`   • ${changes.filter(c => c.change_type === 'modified').length} stations modified`)
        console.log(`   • ${affectedRegions.states.size} states affected`)
        console.log(`   • ${affectedRegions.zips.size} zip codes affected`)
        
        return affectedRegions
    }
    
    /**
     * Determine if station changes are significant enough to warrant re-aggregation
     */
    private static hasSignificantChanges(old_station: any, new_station: any): boolean {
        // Check for changes that affect scoring/filtering
        return (
            old_station.charger_type_detailed !== new_station.charger_type_detailed ||
            JSON.stringify(old_station.ev_connector_types) !== JSON.stringify(new_station.ev_connector_types) ||
            Math.abs(old_station.latitude - new_station.latitude) > 0.001 || // Moved significantly
            Math.abs(old_station.longitude - new_station.longitude) > 0.001 ||
            old_station.state !== new_station.state ||
            old_station.zip !== new_station.zip
        )
    }
    
    /**
     * Get counties affected by zip code changes
     */
    static async getAffectedCounties(affectedZips: Set<string>): Promise<Set<string>> {
        if (affectedZips.size === 0) return new Set()
        
        // Query county mapping for affected zip codes
        // This would require a zip->county mapping table or geocoding
        // For now, we'll use a simplified approach
        
        const counties = new Set<string>()
        const zipArray = Array.from(affectedZips)
        
        // Get state info for affected zips to determine counties
        // This is simplified - in practice you'd want a proper zip->county mapping
        for (const zip of zipArray) {
            const state = zip.substring(0, 2) // Simplified state detection
            // Add state-level county detection logic here
            counties.add(`${state}-*`) // Wildcard for now
        }
        
        return counties
    }
    
    /**
     * Save change detection results for audit/debugging
     */
    static async saveChangeLog(changes: RegionChanges): Promise<void> {
        try {
            await supabaseAdmin.from('change_logs').insert({
                detected_at: new Date().toISOString(),
                states_affected: Array.from(changes.states),
                counties_affected: Array.from(changes.counties),
                zips_affected: Array.from(changes.zips),
                total_changes: changes.total_changes
            })
        } catch (error) {
            console.error('Failed to save change log:', error)
            // Don't throw - this is just for auditing
        }
    }
}