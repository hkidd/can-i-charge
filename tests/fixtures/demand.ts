import type { DemandData } from '@/lib/charging-demand'
import { emptyPublicSupply } from '@/lib/station-filters'
export const demandFixture: DemandData = {
    source: 'fixture', source_year: 2025, state_code: 'CO', bev: 2970, phev: 330,
    state_population: 10000, national_plugin_count: 7454800, allocation: 'state_registration',
    state_road_miles_per_capita: null, national_road_miles_per_capita: null
}
export function scoreFixture(level2 = 100, fast = 19) {
    const public_supply = emptyPublicSupply()
    for (const family of ['all','tesla','other'] as const) {
        Object.assign(public_supply[family], { charger_count: 20, level2_count: 18, dcfast_count: 2,
            level2_ports: level2, dcfast_ports: fast, tesla_count: family === 'other' ? 0 : 2,
            ccs_count: family === 'tesla' ? 0 : 18, site_masks: [0,0,18,0,2,0,0,0] })
    }
    return { population: 10000, charger_count: 20, unknown_port_station_count: 0,
        public_supply, demand_data: { ...demandFixture } }
}
