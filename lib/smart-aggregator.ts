import { supabaseAdmin } from './supabase'
import { ChangeDetector, RegionChanges } from './change-detector'
import { generateStateDataOptimized } from './aggregation-optimized'
import { generateCountyDataOptimized } from './county-aggregation-optimized'
import { generateZipData } from './zip-aggregation'

export interface AggregationResult {
    success: boolean
    states_processed: number
    counties_processed: number
    zips_processed: number
    duration_seconds: number
    changes_detected: RegionChanges
    zip_completion: {
        total_affected: number
        completed: number
        remaining: number
        percentage: number
        is_complete: boolean
    }
    error?: string
}

/**
 * Smart aggregation system that only processes regions with changes
 */
export class SmartAggregator {
    
    /**
     * Perform intelligent incremental updates
     */
    static async performIncrementalUpdate(
        levels: ('states' | 'counties' | 'zips')[] = ['states'],
        useStaging: boolean = true
    ): Promise<AggregationResult> {
        const startTime = Date.now()
        const result: AggregationResult = {
            success: false,
            states_processed: 0,
            counties_processed: 0,
            zips_processed: 0,
            duration_seconds: 0,
            changes_detected: {
                states: new Set(),
                counties: new Set(),
                zips: new Set(),
                total_changes: 0
            },
            zip_completion: {
                total_affected: 0,
                completed: 0,
                remaining: 0,
                percentage: 0,
                is_complete: true
            }
        }
        
        try {
            console.log('🔄 Starting smart incremental aggregation...')
            console.log(`📊 Levels to process: ${levels.join(', ')}`)
            
            // Step 1: Detect changes
            const changes = await ChangeDetector.detectChanges(useStaging)
            result.changes_detected = changes
            
            if (changes.total_changes === 0) {
                console.log('✅ No changes detected - skipping aggregation')
                result.success = true
                result.duration_seconds = (Date.now() - startTime) / 1000
                return result
            }
            
            // Step 2: Process each level based on detected changes
            if (levels.includes('states') && changes.states.size > 0) {
                console.log(`🏛️  Processing ${changes.states.size} changed states...`)
                result.states_processed = await this.processChangedStates(changes.states, useStaging)
            }
            
            if (levels.includes('counties') && changes.counties.size > 0) {
                console.log(`🏘️  Processing ${changes.counties.size} changed counties...`)
                result.counties_processed = await this.processChangedCounties(changes.counties, useStaging)
            }
            
            if (levels.includes('zips') && changes.zips.size > 0) {
                console.log(`📮 Processing ${changes.zips.size} changed zip codes...`)
                result.zips_processed = await this.processChangedZips(changes.zips, useStaging)
                
                // Calculate completion status
                const completion = await this.calculateZipCompletion(changes.zips, useStaging)
                result.zip_completion = completion
                
                console.log(`📊 ZIP Completion Status: ${completion.completed}/${completion.total_affected} (${completion.percentage}%)`)
                if (completion.is_complete) {
                    console.log(`✅ All ZIP codes processed successfully!`)
                } else {
                    console.log(`⏳ ${completion.remaining} ZIP codes remaining to process`)
                }
            }
            
            // Step 3: Save change log for audit
            await ChangeDetector.saveChangeLog(changes)
            
            result.success = true
            result.duration_seconds = (Date.now() - startTime) / 1000
            
            console.log(`✅ Smart aggregation complete in ${result.duration_seconds}s`)
            console.log(`   📊 Processed: ${result.states_processed} states, ${result.counties_processed} counties, ${result.zips_processed} zips`)
            
            return result
            
        } catch (error) {
            console.error('❌ Smart aggregation failed:', error)
            result.error = error instanceof Error ? error.message : 'Unknown error'
            result.duration_seconds = (Date.now() - startTime) / 1000
            return result
        }
    }
    
    /**
     * Process only states that have changes
     */
    private static async processChangedStates(changedStates: Set<string>, useStaging: boolean): Promise<number> {
        if (changedStates.size === 0) return 0
        
        // For states, it's more efficient to regenerate all since the query is already optimized
        // and filtering by specific states would complicate the current optimized aggregation
        console.log('🔄 Regenerating all state data (optimized query handles all states efficiently)')
        return await generateStateDataOptimized(useStaging)
    }
    
    /**
     * Process only counties that have changes
     */
    private static async processChangedCounties(changedCounties: Set<string>, useStaging: boolean): Promise<number> {
        if (changedCounties.size === 0) return 0
        
        // For now, regenerate all counties since the current implementation processes all
        // TODO: Implement selective county processing for even better performance
        console.log('🔄 Regenerating county data for changed regions')
        console.log('   💡 Future optimization: selective county processing')
        return await generateCountyDataOptimized(useStaging)
    }
    
    /**
     * Process zip codes in batches to avoid timeouts
     */
    private static async processChangedZips(changedZips: Set<string>, useStaging: boolean): Promise<number> {
        if (changedZips.size === 0) return 0
        
        const zipArray = Array.from(changedZips)
        const maxBatchSize = 100 // Reduced for 5-minute Hobby plan limit
        let totalProcessed = 0
        
        console.log(`📮 Processing ${zipArray.length} changed zip codes in batches of ${maxBatchSize}`)
        
        for (let i = 0; i < zipArray.length; i += maxBatchSize) {
            const batch = zipArray.slice(i, i + maxBatchSize)
            const batchNum = Math.floor(i / maxBatchSize) + 1
            const totalBatches = Math.ceil(zipArray.length / maxBatchSize)
            
            console.log(`Processing ZIP batch ${batchNum}/${totalBatches}: ${batch.length} ZIPs`)
            
            try {
                // Process this batch
                const processed = await this.processZipBatch(batch, useStaging)
                totalProcessed += processed
                
                console.log(`✓ Completed batch ${batchNum}/${totalBatches}: ${processed} ZIPs processed`)
                
                // Small delay to prevent overwhelming the database
                if (i + maxBatchSize < zipArray.length) {
                    await new Promise(resolve => setTimeout(resolve, 200))
                }
            } catch (error) {
                console.error(`❌ Failed to process ZIP batch ${batchNum}:`, error)
                // Continue with next batch even if this one fails
            }
        }
        
        console.log(`✅ Completed all ZIP processing: ${totalProcessed}/${zipArray.length} ZIPs processed`)
        return totalProcessed
    }

    /**
     * Process a batch of ZIP codes with full original logic
     */
    private static async processZipBatch(zipCodes: string[], useStaging: boolean): Promise<number> {
        const tableName = useStaging ? 'zip_level_data_staging' : 'zip_level_data'
        const stationsTable = 'charging_stations'
        
        try {
            // Fetch stations for these specific ZIP codes
            const { data: stations, error } = await supabaseAdmin
                .from(stationsTable)
                .select('*, ev_connector_types, num_ports')
                .in('zip', zipCodes)
                .not('zip', 'is', null)
                .not('state', 'is', null)
            
            if (error) {
                throw new Error(`Failed to fetch stations for ZIP batch: ${error.message}`)
            }
            
            if (!stations || stations.length === 0) {
                console.log('No stations found for this ZIP batch')
                return 0
            }
            
            // Group stations by zip code
            const zipGroups = new Map<string, any[]>()
            
            stations.forEach((station) => {
                // Clean zip code (remove +4 extension if present)
                const cleanZip = station.zip?.split('-')[0]?.trim()
                if (!cleanZip || cleanZip.length !== 5) return
                
                const key = `${cleanZip}-${station.state}`
                if (!zipGroups.has(key)) {
                    zipGroups.set(key, [])
                }
                zipGroups.get(key)!.push(station)
            })
            
            console.log(`Processing ${zipGroups.size} unique zip codes from batch...`)
            
            // First, collect all ZIP codes for batch population lookup
            const zipCodesForPopulation = Array.from(zipGroups.keys()).map(key => key.split('-')[0])
            
            // Fetch all populations in a single batch request
            console.log(`Fetching populations for ${zipCodesForPopulation.length} ZIP codes...`)
            const { fetchZipPopulationBatch } = await import('./census-api')
            const populationMap = await fetchZipPopulationBatch(zipCodesForPopulation)
            
            let zipData: any[] = []
            let processedCount = 0
            
            for (const [key, zipStations] of zipGroups.entries()) {
                const [zipCode, state] = key.split('-')
                
                // Calculate center point from all stations in this zip
                const avgLat = zipStations.reduce((sum, s) => sum + s.latitude, 0) / zipStations.length
                const avgLng = zipStations.reduce((sum, s) => sum + s.longitude, 0) / zipStations.length
                
                // Count charger types and connector types
                let dcfast = 0, level2 = 0, level1 = 0
                let tesla = 0, ccs = 0, j1772 = 0, chademo = 0
                let teslaPorts = 0, ccsPorts = 0, j1772Ports = 0, chademoPorts = 0, totalPorts = 0
                
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
                const weightedChargerCount = dcfast * 1.0 + level2 * 0.7 + level1 * 0.3
                
                // Get population from batch results
                const population = populationMap.get(zipCode) || this.estimateZipPopulation()
                
                const { calculateNeedScore } = await import('./scoring')
                const { calculateWeightedEVScore } = await import('./aggregation-optimized')
                
                const needScore = calculateNeedScore(population, totalChargers)
                const score = calculateWeightedEVScore(weightedChargerCount, population)
                
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
                if (processedCount % 50 === 0) {
                    console.log(`Processed ${processedCount} / ${zipGroups.size} zip codes in this batch...`)
                }
            }
            
            // Insert the processed ZIP data
            if (zipData.length > 0) {
                // First delete existing records for these ZIPs
                const zipCodesToDelete = zipData.map(record => record.zip_code)
                await supabaseAdmin
                    .from(tableName)
                    .delete()
                    .in('zip_code', zipCodesToDelete)
                
                // Insert new records
                const { error: insertError } = await supabaseAdmin
                    .from(tableName)
                    .insert(zipData)
                
                if (insertError) {
                    throw new Error(`Failed to insert ZIP data: ${insertError.message}`)
                }
                
                console.log(`✓ Inserted ${zipData.length} ZIP records`)
            }
            
            return zipData.length
            
        } catch (error) {
            console.error(`Error processing ZIP batch:`, error)
            throw error
        }
    }

    private static estimateZipPopulation(): number {
        // Return a reasonable estimate for ZIP code population
        return Math.floor(Math.random() * 15000) + 5000 // 5k-20k range
    }

    /**
     * Calculate ZIP code processing completion status
     */
    private static async calculateZipCompletion(originalAffectedZips: Set<string>, useStaging: boolean): Promise<{
        total_affected: number
        completed: number  
        remaining: number
        percentage: number
        is_complete: boolean
    }> {
        try {
            const totalAffected = originalAffectedZips.size
            const stagingTable = 'zip_level_data_staging'
            
            // Count how many affected ZIP codes are already in staging
            const affectedZipsArray = Array.from(originalAffectedZips)
            const chunkSize = 1000
            let completedCount = 0
            
            // Process in chunks to avoid query limits
            for (let i = 0; i < affectedZipsArray.length; i += chunkSize) {
                const chunk = affectedZipsArray.slice(i, i + chunkSize)
                
                try {
                    const { data, error } = await supabaseAdmin
                        .from(stagingTable)
                        .select('zip_code', { count: 'exact' })
                        .in('zip_code', chunk)
                    
                    if (!error && data) {
                        completedCount += data.length
                    }
                } catch (chunkError) {
                    console.warn(`Error checking completion for chunk ${i}:`, chunkError)
                }
            }
            
            const remaining = totalAffected - completedCount
            const percentage = Math.round((completedCount / totalAffected) * 100)
            const isComplete = remaining === 0
            
            return {
                total_affected: totalAffected,
                completed: completedCount,
                remaining: remaining, 
                percentage: percentage,
                is_complete: isComplete
            }
            
        } catch (error) {
            console.error('Error calculating ZIP completion:', error)
            return {
                total_affected: originalAffectedZips.size,
                completed: 0,
                remaining: originalAffectedZips.size,
                percentage: 0,
                is_complete: false
            }
        }
    }
    
    /**
     * Full regeneration (fallback for when incremental updates fail)
     */
    static async performFullRegeneration(useStaging: boolean = true): Promise<AggregationResult> {
        const startTime = Date.now()
        
        try {
            console.log('🔄 Performing full aggregation regeneration...')
            
            const statesCount = await generateStateDataOptimized(useStaging)
            const countiesCount = await generateCountyDataOptimized(useStaging)
            const zipsCount = await generateZipData(useStaging)
            
            const duration = (Date.now() - startTime) / 1000
            
            return {
                success: true,
                states_processed: statesCount,
                counties_processed: countiesCount,
                zips_processed: zipsCount,
                duration_seconds: duration,
                changes_detected: {
                    states: new Set(['*']),
                    counties: new Set(['*']),
                    zips: new Set(['*']),
                    total_changes: -1 // Indicates full regeneration
                },
                zip_completion: {
                    total_affected: zipsCount,
                    completed: zipsCount,
                    remaining: 0,
                    percentage: 100,
                    is_complete: true
                }
            }
        } catch (error) {
            return {
                success: false,
                states_processed: 0,
                counties_processed: 0,
                zips_processed: 0,
                duration_seconds: (Date.now() - startTime) / 1000,
                changes_detected: {
                    states: new Set(),
                    counties: new Set(),
                    zips: new Set(),
                    total_changes: 0
                },
                zip_completion: {
                    total_affected: 0,
                    completed: 0,
                    remaining: 0,
                    percentage: 0,
                    is_complete: false
                },
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }
}