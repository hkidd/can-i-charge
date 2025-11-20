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
     * Process only zip codes that have changes
     */
    private static async processChangedZips(changedZips: Set<string>, useStaging: boolean): Promise<number> {
        if (changedZips.size === 0) return 0
        
        // For now, regenerate all zips since the current implementation processes all
        // TODO: Implement selective zip processing for even better performance  
        console.log('🔄 Regenerating zip data for changed regions')
        console.log(`   📮 ${changedZips.size} zip codes affected`)
        console.log('   💡 Future optimization: selective zip processing')
        return await generateZipData(useStaging)
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
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }
}