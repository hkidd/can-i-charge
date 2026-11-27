import type { TrafficData } from './traffic-data'
import { trafficPerCapita } from './traffic-data'

// A versioned national planning benchmark, scaled to the local plug-in fleet.
// NREL 2030 National Charging Network: 33m PEVs, 1m public L2, 182k public DC.
export const DEMAND_MODEL = {
    version: 'fleet-provision-v1', registration_year: 2025, scenario_year: 2030,
    scenario_plugin_count: 33000000, level2_per_vehicle: 1000000 / 33000000,
    fast_per_vehicle: 182000 / 33000000, fast_per_bev: 182000 / (33000000 * 0.9), destination_weight: 85, fast_weight: 15,
    minimum_traffic_multiplier: 0.5, maximum_traffic_multiplier: 2,
    source: 'https://driveelectric.gov/files/2030-charging-network.pdf'
} as const
export interface DemandData {
    source: string; source_year: number; state_code: string
    bev: number; phev: number; state_population: number
    national_plugin_count: number
    allocation: 'state_registration' | 'population_estimate'
    state_road_miles_per_capita: number | null
    national_road_miles_per_capita: number | null
}
export interface ReadinessEvidence {
    model_version: string
    horizon: 'current' | '2030_scenario'
    registration_year: number
    fleet_basis: 'state_registration' | 'population_estimate'
    estimated_plugin_vehicles: number
    scenario_plugin_vehicles: number
    traffic_basis: 'regional_2023' | 'state_2023_proxy' | 'unavailable'
    traffic_multiplier: number
    level2_ports: number
    fast_ports: number
    target_level2_ports: number
    target_fast_ports: number
    level2_gap: number
    fast_gap: number
    level2_coverage: number
    fast_coverage: number
    excluded_restricted_stations: number
    excluded_unknown_access_stations: number
    summary: string
    limitations: string
}
export function demandTargets(data: DemandData | null | undefined, population: number | null | undefined,
    traffic: TrafficData | null | undefined, future: boolean) {
    if (!data || !population || !Number.isFinite(population) || population <= 0 ||
        ![data.bev, data.phev, data.state_population, data.national_plugin_count].every(n => Number.isFinite(n) && n >= 0) ||
        data.state_population <= 0 || data.national_plugin_count <= 0 || data.bev + data.phev <= 0) return null
    const fleet = (data.bev + data.phev) * (data.allocation === 'state_registration' ? 1 : population / data.state_population)
    const observed = trafficPerCapita(traffic, population)
    const intensity = observed ?? data.state_road_miles_per_capita
    const reference = data.national_road_miles_per_capita
    const multiplier = intensity !== null && reference !== null && Number.isFinite(intensity) && intensity > 0 && reference > 0
        ? Math.max(DEMAND_MODEL.minimum_traffic_multiplier, Math.min(DEMAND_MODEL.maximum_traffic_multiplier, intensity / reference)) : 1
    const scenarioFleet = fleet * Math.max(1, DEMAND_MODEL.scenario_plugin_count / data.national_plugin_count)
    const vehicles = (future ? scenarioFleet : fleet) * multiplier
    return { fleet, scenarioFleet, multiplier,
        trafficBasis: observed !== null ? 'regional_2023' as const : intensity !== null ? 'state_2023_proxy' as const : 'unavailable' as const,
        level2: vehicles * DEMAND_MODEL.level2_per_vehicle, fast: future ? vehicles * DEMAND_MODEL.fast_per_vehicle : vehicles * data.bev / (data.bev + data.phev) * DEMAND_MODEL.fast_per_bev }
}
export function evidenceSummary(e: Omit<ReadinessEvidence, 'summary' | 'limitations'>): string {
    const number = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })
    const fleet = e.horizon === '2030_scenario' ? e.scenario_plugin_vehicles : e.estimated_plugin_vehicles
    const basis = e.fleet_basis === 'state_registration' ? 'state registrations' : 'state registrations allocated by population'
    return `${e.horizon === '2030_scenario' ? '2030 scenario' : 'Current planning estimate'}: ${number(fleet)} plug-in vehicles (${basis}, ${e.registration_year} baseline). ` +
        `${number(e.level2_ports)} Level 2 / ${number(e.target_level2_ports)} target; ${number(e.fast_ports)} fast / ${number(e.target_fast_ports)} target. ` +
        (e.horizon === '2030_scenario' ? 'Opportunity measures the projected capacity gap.' : '100 means both modeled provision targets are met.')
}
