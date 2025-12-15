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
     * Clean ZIP code to match staging format (5-digit only)
     */
    private static cleanZipCode(zip: string): string | null {
        const cleanZip = zip.split('-')[0]?.trim()
        return cleanZip && cleanZip.length === 5 ? cleanZip : null
    }
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
                if (station.zip) {
                    const cleanZip = this.cleanZipCode(station.zip)
                    if (cleanZip) affectedRegions.zips.add(cleanZip)
                }
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
                if (station.zip) {
                    const cleanZip = this.cleanZipCode(station.zip)
                    if (cleanZip) affectedRegions.zips.add(cleanZip)
                }
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
                if (current.zip) {
                    const cleanZip = this.cleanZipCode(current.zip)
                    if (cleanZip) affectedRegions.zips.add(cleanZip)
                }
                
                // If station moved states/zips, mark old ones too
                if (previous.state !== current.state) {
                    affectedRegions.states.add(previous.state)
                }
                if (previous.zip !== current.zip && previous.zip) {
                    const cleanZip = this.cleanZipCode(previous.zip)
                    if (cleanZip) affectedRegions.zips.add(cleanZip)
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
        
        // Filter out ZIP codes that are already processed in staging
        if (useStaging && affectedRegions.zips.size > 0) {
            const filteredZips = await this.filterAlreadyProcessedZips(affectedRegions.zips, useStaging)
            if (filteredZips.size !== affectedRegions.zips.size) {
                console.log(`   • ${affectedRegions.zips.size - filteredZips.size} zip codes already processed, skipping`)
                console.log(`   • ${filteredZips.size} zip codes remaining to process`)
                affectedRegions.zips = filteredZips
            }
        }
        
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
     * Filter out ZIP codes that are already up-to-date in production
     */
    private static async filterAlreadyProcessedZips(affectedZips: Set<string>, useStaging: boolean): Promise<Set<string>> {
        if (!useStaging || affectedZips.size === 0) return affectedZips
        
        try {
            // First check if ZIPs are already in staging (previous behavior)
            const stagingTable = 'zip_level_data_staging'
            const zipArray = Array.from(affectedZips)
            const chunkSize = 500
            const processedZipSet = new Set<string>()
            
            // Check staging table first
            for (let i = 0; i < zipArray.length; i += chunkSize) {
                const chunk = zipArray.slice(i, i + chunkSize)
                
                try {
                    const { data: existingZips, error } = await supabaseAdmin
                        .from(stagingTable)
                        .select('zip_code')
                        .in('zip_code', chunk)
                    
                    if (!error && existingZips) {
                        existingZips.forEach(z => processedZipSet.add(z.zip_code))
                    }
                } catch (chunkError) {
                    console.warn(`Error checking staging for chunk ${i}:`, chunkError)
                }
            }
            
            if (processedZipSet.size > 0) {
                console.log(`📋 Found ${processedZipSet.size} ZIP codes already in staging`)
            }
            
            // For remaining ZIPs, check if production data is current
            const remainingAfterStaging = new Set<string>()
            for (const zip of affectedZips) {
                if (!processedZipSet.has(zip)) {
                    remainingAfterStaging.add(zip)
                }
            }
            
            if (remainingAfterStaging.size === 0) {
                return remainingAfterStaging
            }
            
            console.log(`🔍 Checking if ${remainingAfterStaging.size} ZIP codes need updates based on current station data...`)
            
            // Check if ZIP codes in production match current station data
            const outdatedZips = await this.findOutdatedZipsInProduction(remainingAfterStaging)
            
            console.log(`📊 Production analysis: ${outdatedZips.size} ZIP codes need updates, ${remainingAfterStaging.size - outdatedZips.size} are current`)
            
            return outdatedZips
            
        } catch (error) {
            console.warn('Error filtering ZIP codes, processing all:', error instanceof Error ? error.message : error)
            return affectedZips
        }
    }
    
    /**
     * Check which ZIP codes in production have outdated data compared to current stations
     */
    private static async findOutdatedZipsInProduction(zipCodes: Set<string>): Promise<Set<string>> {
        if (zipCodes.size === 0) return new Set()
        
        const outdatedZips = new Set<string>()
        const zipArray = Array.from(zipCodes)
        const chunkSize = 100 // Smaller chunks for this complex operation
        
        for (let i = 0; i < zipArray.length; i += chunkSize) {
            const chunk = zipArray.slice(i, i + chunkSize)
            
            try {
                // Get current station counts for these ZIP codes
                const { data: currentStations, error: stationsError } = await supabaseAdmin
                    .from('charging_stations')
                    .select('zip, state, charger_type_detailed')
                    .in('zip', chunk.concat(chunk.map(z => z + '-0000'))) // Include extended ZIP codes
                    .not('zip', 'is', null)
                
                if (stationsError) {
                    console.warn(`Error fetching current stations for ZIP chunk:`, stationsError)
                    // Add all to outdated to be safe
                    chunk.forEach(zip => outdatedZips.add(zip))
                    continue
                }
                
                // Get production ZIP data for comparison
                const { data: productionZips, error: zipError } = await supabaseAdmin
                    .from('zip_level_data')
                    .select('zip_code, state, charger_count, dcfast_count, level2_count, level1_count')
                    .in('zip_code', chunk)
                
                if (zipError) {
                    console.warn(`Error fetching production ZIP data:`, zipError)
                    // Add all to outdated to be safe
                    chunk.forEach(zip => outdatedZips.add(zip))
                    continue
                }
                
                // Calculate current station counts per ZIP
                const currentCounts = new Map<string, {charger_count: number, dcfast: number, level2: number, level1: number}>()
                
                if (currentStations) {
                    for (const station of currentStations) {
                        const cleanZip = this.cleanZipCode(station.zip)
                        if (!cleanZip) continue
                        
                        const key = `${cleanZip}-${station.state}`
                        const existing = currentCounts.get(key) || {charger_count: 0, dcfast: 0, level2: 0, level1: 0}
                        
                        existing.charger_count++
                        if (station.charger_type_detailed === 'dcfast') existing.dcfast++
                        else if (station.charger_type_detailed === 'level2') existing.level2++
                        else if (station.charger_type_detailed === 'level1') existing.level1++
                        
                        currentCounts.set(key, existing)
                    }
                }
                
                // Compare with production data
                if (productionZips) {
                    for (const prodZip of productionZips) {
                        const key = `${prodZip.zip_code}-${prodZip.state}`
                        const currentData = currentCounts.get(key)
                        
                        // If no current stations but production has data, it's outdated
                        if (!currentData && prodZip.charger_count > 0) {
                            outdatedZips.add(prodZip.zip_code)
                            continue
                        }
                        
                        // If current stations but no production data, it needs update  
                        if (currentData && !prodZip) {
                            outdatedZips.add(key.split('-')[0])
                            continue
                        }
                        
                        // Compare counts if both exist
                        if (currentData && prodZip) {
                            if (currentData.charger_count !== prodZip.charger_count ||
                                currentData.dcfast !== prodZip.dcfast_count ||
                                currentData.level2 !== prodZip.level2_count ||
                                currentData.level1 !== prodZip.level1_count) {
                                outdatedZips.add(prodZip.zip_code)
                            }
                        }
                    }
                }
                
                // Check for ZIP codes that have current stations but no production record
                for (const [key] of currentCounts) {
                    const zipCode = key.split('-')[0]
                    const hasProductionRecord = productionZips?.some(p => p.zip_code === zipCode)
                    if (!hasProductionRecord) {
                        outdatedZips.add(zipCode)
                    }
                }
                
            } catch (chunkError) {
                console.warn(`Error processing ZIP comparison chunk ${i}:`, chunkError)
                // Add chunk to outdated to be safe
                chunk.forEach(zip => outdatedZips.add(zip))
            }
        }
        
        return outdatedZips
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