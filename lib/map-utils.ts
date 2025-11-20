export function getStateCodeFromFIPS(fips: string): string | null {
    const fipsToState: Record<string, string> = {
        '01': 'AL',
        '02': 'AK',
        '04': 'AZ',
        '05': 'AR',
        '06': 'CA',
        '08': 'CO',
        '09': 'CT',
        '10': 'DE',
        '12': 'FL',
        '13': 'GA',
        '15': 'HI',
        '16': 'ID',
        '17': 'IL',
        '18': 'IN',
        '19': 'IA',
        '20': 'KS',
        '21': 'KY',
        '22': 'LA',
        '23': 'ME',
        '24': 'MD',
        '25': 'MA',
        '26': 'MI',
        '27': 'MN',
        '28': 'MS',
        '29': 'MO',
        '30': 'MT',
        '31': 'NE',
        '32': 'NV',
        '33': 'NH',
        '34': 'NJ',
        '35': 'NM',
        '36': 'NY',
        '37': 'NC',
        '38': 'ND',
        '39': 'OH',
        '40': 'OK',
        '41': 'OR',
        '42': 'PA',
        '44': 'RI',
        '45': 'SC',
        '46': 'SD',
        '47': 'TN',
        '48': 'TX',
        '49': 'UT',
        '50': 'VT',
        '51': 'VA',
        '53': 'WA',
        '54': 'WV',
        '55': 'WI',
        '56': 'WY'
    }

    return fipsToState[fips] || null
}

export function calculateFilteredScore(
    weightedChargerCount: number,
    population: number,
    vmtPerCapita?: number,
    isPortCount: boolean = false
): number {
    // Legacy calculation if no traffic data available
    if (!vmtPerCapita) {
        const chargersPerCapita = (weightedChargerCount / population) * 100000

        let score: number
        if (isPortCount) {
            // Different thresholds for port counts (roughly 3-5x station thresholds)
            if (chargersPerCapita >= 200) {
                score = 80 + Math.min(((chargersPerCapita - 200) / 100) * 20, 20)
            } else if (chargersPerCapita >= 120) {
                score = 70 + ((chargersPerCapita - 120) / 80) * 10
            } else if (chargersPerCapita >= 75) {
                score = 55 + ((chargersPerCapita - 75) / 45) * 15
            } else if (chargersPerCapita >= 40) {
                score = 40 + ((chargersPerCapita - 40) / 35) * 15
            } else if (chargersPerCapita >= 20) {
                score = 25 + ((chargersPerCapita - 20) / 20) * 15
            } else {
                score = (chargersPerCapita / 20) * 25
            }
        } else {
            // Original station-based thresholds
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
        }

        return Math.round(Math.min(100, Math.max(0, score)))
    }

    // Enhanced calculation with traffic data as demand multiplier
    // High VMT = higher charging demand = need more chargers for same score
    
    // Calculate traffic demand multiplier (1.0 = baseline, higher = more demand)
    const baselineVMT = 25 // Average daily VMT per capita
    const trafficMultiplier = Math.max(0.5, Math.min(2.0, vmtPerCapita / baselineVMT))
    
    // Adjust charger requirements based on traffic demand
    const chargersPerCapita = (weightedChargerCount / population) * 100000
    const adjustedChargersPerCapita = chargersPerCapita / trafficMultiplier
    
    // Charger score with traffic-adjusted thresholds (70% weight)
    let chargerScore = 0
    if (isPortCount) {
        // Port-based thresholds (roughly 3-5x station thresholds)
        if (adjustedChargersPerCapita >= 300) chargerScore = 100  // Exceptional coverage
        else if (adjustedChargersPerCapita >= 180) chargerScore = 85 + ((adjustedChargersPerCapita - 180) / 120) * 15
        else if (adjustedChargersPerCapita >= 105) chargerScore = 65 + ((adjustedChargersPerCapita - 105) / 75) * 20
        else if (adjustedChargersPerCapita >= 60) chargerScore = 40 + ((adjustedChargersPerCapita - 60) / 45) * 25
        else if (adjustedChargersPerCapita >= 30) chargerScore = 20 + ((adjustedChargersPerCapita - 30) / 30) * 20
        else chargerScore = (adjustedChargersPerCapita / 30) * 20
    } else {
        // Station-based thresholds
        if (adjustedChargersPerCapita >= 100) chargerScore = 100  // Exceptional coverage
        else if (adjustedChargersPerCapita >= 60) chargerScore = 85 + ((adjustedChargersPerCapita - 60) / 40) * 15
        else if (adjustedChargersPerCapita >= 35) chargerScore = 65 + ((adjustedChargersPerCapita - 35) / 25) * 20
        else if (adjustedChargersPerCapita >= 20) chargerScore = 40 + ((adjustedChargersPerCapita - 20) / 15) * 25
        else if (adjustedChargersPerCapita >= 10) chargerScore = 20 + ((adjustedChargersPerCapita - 10) / 10) * 20
        else chargerScore = (adjustedChargersPerCapita / 10) * 20
    }

    // Population density component (30% weight) - moderate influence
    const populationDensityScore = Math.min((population / 300000) * 100, 100)

    // Weighted combination - Chargers (adjusted for traffic) matter most
    const totalScore = (chargerScore * 0.7) + (populationDensityScore * 0.3)

    return Math.round(Math.min(100, Math.max(0, totalScore)))
}

export function calculateTrafficScore(vmtPerCapita: number): number {
    // Normalize traffic volume to 0-100 scale
    // Based on typical US VMT per capita ranges (10-50 miles/day)
    const normalizedVMT = Math.min(vmtPerCapita / 50, 1)
    return Math.round(normalizedVMT * 100)
}

export function calculateOpportunityScore(
    chargerCount: number,
    population: number,
    vmtPerCapita?: number
): number {
    if (population < 10000) {
        // Low population areas have low opportunity regardless of charger count
        return Math.min(25, (population / 10000) * 25)
    }

    const chargersPerCapita = (chargerCount / population) * 100000
    
    // Apply traffic demand multiplier - high VMT areas have higher opportunity
    const trafficMultiplier = vmtPerCapita ? Math.max(0.5, Math.min(2.0, vmtPerCapita / 25)) : 1.0
    
    // Invert the logic: high population + low charger density + high traffic = high opportunity
    let baseOpportunityScore: number
    
    if (chargersPerCapita <= 5) {
        // Very low charger density in populated area = high opportunity
        baseOpportunityScore = 80 + Math.min(((population / 100000) / 5) * 20, 20)
    } else if (chargersPerCapita <= 15) {
        // Low charger density = good opportunity
        baseOpportunityScore = 60 + ((15 - chargersPerCapita) / 10) * 20
    } else if (chargersPerCapita <= 30) {
        // Moderate charger density = some opportunity
        baseOpportunityScore = 40 + ((30 - chargersPerCapita) / 15) * 20
    } else if (chargersPerCapita <= 50) {
        // High charger density = low opportunity
        baseOpportunityScore = 20 + ((50 - chargersPerCapita) / 20) * 20
    } else {
        // Very high charger density = no opportunity
        baseOpportunityScore = Math.max(0, 20 - ((chargersPerCapita - 50) / 10) * 20)
    }
    
    // Boost opportunity score for high-traffic areas (more demand = more opportunity)
    const opportunityScore = baseOpportunityScore * trafficMultiplier

    return Math.round(Math.min(100, Math.max(0, opportunityScore)))
}

export function applyFiltersToData(
    data: any[],
    filters: { 
        showDCFast: boolean; 
        showLevel2: boolean; 
        showLevel1: boolean;
        showTesla?: boolean;
        showCCS?: boolean;
        opportunityMode?: boolean;
        usePortWeighting?: boolean; // New option to weight by ports vs stations
    }
) {
    return data.map((region) => {
        const dcfast = region.dcfast_count || 0
        const level2 = region.level2_count || 0
        const level1 = region.level1_count || 0
        
        // Get connector type counts/ports if available (for aggregated data)
        const teslaCount = region.tesla_count || 0
        const ccsCount = region.ccs_count || 0
        const j1772Count = region.j1772_count || 0
        const chademoCount = region.chademo_count || 0
        
        // Get port counts if available and port weighting is enabled
        const teslaPorts = region.tesla_ports || 0
        const ccsPorts = region.ccs_ports || 0
        const j1772Ports = region.j1772_ports || 0
        const chademoPorts = region.chademo_ports || 0
        const totalPorts = region.total_ports || 0
        
        // Check if we have connector type data
        const hasConnectorData = teslaCount > 0 || ccsCount > 0 || j1772Count > 0 || chademoCount > 0
        const hasPortData = teslaPorts > 0 || ccsPorts > 0 || j1772Ports > 0 || chademoPorts > 0
        
        // Determine if we should use port weighting
        const usePortWeighting = filters.usePortWeighting && hasPortData

        let weightedCount = 0
        
        if (hasConnectorData && (filters.showTesla !== undefined || filters.showCCS !== undefined)) {
            // Use connector-based filtering when we have connector data and connector filters are set
            let availableChargers = 0
            
            if (filters.showTesla && filters.showCCS) {
                // Show all if both are enabled
                if (usePortWeighting) {
                    availableChargers = totalPorts || (dcfast + level2 + level1)
                } else {
                    availableChargers = dcfast + level2 + level1
                }
            } else if (filters.showTesla && !filters.showCCS) {
                // Only Tesla/NACS
                availableChargers = usePortWeighting ? teslaPorts : teslaCount
            } else if (!filters.showTesla && filters.showCCS) {
                // Only non-Tesla stations (CCS/J1772/CHAdeMO)
                availableChargers = usePortWeighting ? ccsPorts : ccsCount
            } else {
                // Neither enabled
                availableChargers = 0
            }
            
            // Apply level-based weighting to available chargers
            if (usePortWeighting) {
                // When using port weighting, treat availableChargers as total capacity
                // Apply charger level multipliers directly to the port count
                // For simplicity, assume ports are distributed proportionally across charger levels
                const totalChargers = dcfast + level2 + level1
                if (totalChargers > 0) {
                    const dcfastRatio = dcfast / totalChargers
                    const level2Ratio = level2 / totalChargers
                    const level1Ratio = level1 / totalChargers
                    
                    const filteredDcfastPorts = availableChargers * dcfastRatio
                    const filteredLevel2Ports = availableChargers * level2Ratio  
                    const filteredLevel1Ports = availableChargers * level1Ratio
                    
                    // Apply multipliers to port counts (using actual port numbers)
                    if (filters.showDCFast) weightedCount += filteredDcfastPorts * 1.0
                    if (filters.showLevel2) weightedCount += filteredLevel2Ports * 0.7
                    if (filters.showLevel1) weightedCount += filteredLevel1Ports * 0.3
                }
            } else {
                // Traditional station-based counting with proportional distribution
                const totalChargers = dcfast + level2 + level1
                if (totalChargers > 0) {
                    const dcfastRatio = dcfast / totalChargers
                    const level2Ratio = level2 / totalChargers
                    const level1Ratio = level1 / totalChargers
                    
                    const filteredDcfast = availableChargers * dcfastRatio
                    const filteredLevel2 = availableChargers * level2Ratio  
                    const filteredLevel1 = availableChargers * level1Ratio
                    
                    if (filters.showDCFast) weightedCount += filteredDcfast * 1.0
                    if (filters.showLevel2) weightedCount += filteredLevel2 * 0.7
                    if (filters.showLevel1) weightedCount += filteredLevel1 * 0.3
                }
            }
        } else {
            // Fall back to level-based filtering only
            if (filters.showDCFast) weightedCount += dcfast * 1.0
            if (filters.showLevel2) weightedCount += level2 * 0.7
            if (filters.showLevel1) weightedCount += level1 * 0.3
        }

        const population = region.population || 1
        
        // Calculate score based on mode
        const vmtPerCapita = region.vmt_per_capita
        const score = filters.opportunityMode 
            ? calculateOpportunityScore(weightedCount, population, vmtPerCapita)
            : calculateFilteredScore(weightedCount, population, vmtPerCapita, usePortWeighting)

        return {
            ...region,
            score,
            filtered_charger_count: Math.round(weightedCount)
        }
    })
}

export function getScoreColor(score: number): string {
    if (score >= 80) return '#059669'
    if (score >= 60) return '#3b82f6'
    if (score >= 40) return '#f97316'
    return '#dc2626'
}

export function getScoreLabel(score: number): string {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Poor'
}
