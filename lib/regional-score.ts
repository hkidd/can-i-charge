import type { TrafficData } from './traffic-data'
import type { FilterSummary, PublicSupply } from './station-filters'
import { demandTargets, DEMAND_MODEL, evidenceSummary, type DemandData, type ReadinessEvidence } from './charging-demand'
export const SCORING_VERSION = 'fleet-provision-v4'
export const MIN_CAPACITY_REPORTING_FRACTION = 0.95

export interface ScoreDataQuality {
    capacity_reporting: 'complete' | 'partial' | 'insufficient' | 'unknown'
    station_count: number | null
    reported_capacity_station_count: number | null
    unknown_capacity_station_count: number | null
    reporting_fraction: number | null
    minimum_reporting_fraction: number
    message: string | null
}

export interface ScoreInputs {
    demand_data?: DemandData | null
    public_supply?: PublicSupply | null
    traffic_data?: TrafficData | null
    filter_summary?: FilterSummary | null
    charger_count?: number | null
    level1_count?: number | null
    level2_count?: number | null
    dcfast_count?: number | null
    level1_ports?: number | null
    level2_ports?: number | null
    dcfast_ports?: number | null
    tesla_count?: number | null
    ccs_count?: number | null
    unknown_port_station_count?: number | null
    population?: number | null
    vmt_per_capita?: number
}

export function selectScoreInputs(data: ScoreInputs, filters: ScoreFilters): ScoreInputs | null {
    if (filters.showTesla === false && filters.showCCS === false) return null
    const family = filters.showTesla === false ? 'other' : filters.showCCS === false ? 'tesla' : 'all'
    const capacity = data.public_supply?.[family]
    if (!capacity) return null
    return { ...capacity, population: data.population, demand_data: data.demand_data,
        public_supply: data.public_supply, traffic_data: data.traffic_data }

}

export interface ScoreFilters {
    showDCFast: boolean
    showLevel2: boolean
    showLevel1: boolean
    showTesla?: boolean
    showCCS?: boolean
    usePortWeighting?: boolean
    opportunityMode?: boolean
}

export const DEFAULT_SCORE_FILTERS: Required<ScoreFilters> = {
    showDCFast: true,
    showLevel2: true,
    showLevel1: true,
    showTesla: true,
    showCCS: true,
    usePortWeighting: true,
    opportunityMode: false
}

export interface ScoreBreakdown {
    nearby_chargers: number
    fast_charging: number
    network_diversity: number
    charging_density: number
}

function validCount(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Coverage measures reporting sites, not an estimate of unreported ports. */
export function getScoreDataQuality(data: ScoreInputs): ScoreDataQuality {
    const total = data.charger_count
    const missing = data.unknown_port_station_count
    if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0 ||
        typeof missing !== 'number' || !Number.isSafeInteger(missing) || missing < 0 || missing > total) {
        return { capacity_reporting: 'unknown', station_count: null, reported_capacity_station_count: null,
            unknown_capacity_station_count: null, reporting_fraction: null,
            minimum_reporting_fraction: MIN_CAPACITY_REPORTING_FRACTION,
            message: 'Capacity reporting is unavailable for this region.' }
    }
    const known = total - missing
    const fraction = total > 0 ? known / total : 1
    const status = missing === 0 ? 'complete' : known >= total * MIN_CAPACITY_REPORTING_FRACTION ? 'partial' : 'insufficient'
    const coverage = `Capacity reported at ${known.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} stations.`
    return { capacity_reporting: status, station_count: total, reported_capacity_station_count: known,
        unknown_capacity_station_count: missing, reporting_fraction: fraction,
        minimum_reporting_fraction: MIN_CAPACITY_REPORTING_FRACTION,
        message: status === 'complete' ? null : status === 'partial' ? `${coverage} Score uses reported capacity.` :
            `${coverage} At least 95% reporting is required for a regional score.` }
}

/** The absolute planning index: provision toward L2 and DC targets, with no presence bonuses. */
export function calculateRegionalScore(
    data: ScoreInputs,
    population: number | null | undefined = data.population,
    filters: ScoreFilters = DEFAULT_SCORE_FILTERS
): { score: number | null; breakdown: ScoreBreakdown | null; evidence: ReadinessEvidence | null } {
    const unrated = { score: null, breakdown: null, evidence: null }
    const targets = demandTargets(data.demand_data, population, data.traffic_data, !!filters.opportunityMode)
    if (!targets) return unrated
    const noSelection = (!filters.showLevel1 && !filters.showLevel2 && !filters.showDCFast) ||
        (filters.showTesla === false && filters.showCCS === false)
    const selected = selectScoreInputs(data, filters)
    if (!selected && !noSelection) return unrated
    const quality = selected ? getScoreDataQuality(selected) : null
    if (quality && quality.capacity_reporting !== 'complete' && quality.capacity_reporting !== 'partial') return unrated
    if (selected && ![selected.level1_ports, selected.level2_ports, selected.dcfast_ports].every(validCount)) return unrated
    const level2 = !noSelection && filters.showLevel2 ? selected!.level2_ports! : 0
    const fast = !noSelection && filters.showDCFast ? selected!.dcfast_ports! : 0
    const l2Coverage = Math.min(1, level2 / targets.level2)
    const fastCoverage = Math.min(1, fast / targets.fast)
    const destinationPoints = Math.round(DEMAND_MODEL.destination_weight * l2Coverage)
    const fastPoints = Math.round(DEMAND_MODEL.fast_weight * fastCoverage)
    const provision = destinationPoints + fastPoints
    const score = noSelection ? 0 : filters.opportunityMode ? 100 - provision : provision
    // Legacy keys retained for API clients. Only the two demand components remain.
    const breakdown = { nearby_chargers: destinationPoints, fast_charging: fastPoints,
        network_diversity: 0, charging_density: 0 }
    const values: Omit<ReadinessEvidence, 'summary' | 'limitations'> = {
        model_version: DEMAND_MODEL.version, horizon: filters.opportunityMode ? '2030_scenario' : 'current',
        registration_year: data.demand_data!.source_year, fleet_basis: data.demand_data!.allocation,
        estimated_plugin_vehicles: targets.fleet, scenario_plugin_vehicles: targets.scenarioFleet,
        traffic_basis: targets.trafficBasis, traffic_multiplier: targets.multiplier,
        level2_ports: level2, fast_ports: fast, target_level2_ports: targets.level2,
        target_fast_ports: targets.fast, level2_gap: Math.max(0, targets.level2 - level2),
        fast_gap: Math.max(0, targets.fast - fast), level2_coverage: l2Coverage, fast_coverage: fastCoverage,
        excluded_restricted_stations: data.public_supply?.restricted_stations ?? 0,
        excluded_unknown_access_stations: data.public_supply?.unknown_access_stations ?? 0
    }
    const evidence = { ...values, summary: evidenceSummary(values),
        limitations: 'Planning benchmark, not measured utilization or guaranteed availability. Local EV ownership, charger uptime, power, home charging and route coverage are not measured. Connector filters keep the whole regional fleet as demand; Level 1 ports do not satisfy Level 2 or fast targets.' }
    return { score, breakdown, evidence }
}
