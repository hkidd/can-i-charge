import type { Station } from './station-model'

export const CONNECTOR_FAMILIES = {
    tesla: ['TESLA', 'NACS', 'J3400'],
    other: ['J1772COMBO', 'J1772', 'CHADEMO', 'J3271', 'NEMA515', 'NEMA520', 'NEMA1450']
} as const
export const SPEEDS = ['level1', 'level2', 'dcfast'] as const
export type ConnectorFamily = keyof typeof CONNECTOR_FAMILIES
export interface CapacitySummary {
    charger_count: number
    unknown_port_station_count: number
    level1_count: number; level2_count: number; dcfast_count: number
    level1_ports: number; level2_ports: number; dcfast_ports: number
    tesla_count: number; ccs_count: number
    // Disjoint speed masks preserve distinct sites for every speed combination.
    site_masks: number[]
}
export interface FilterSummary {
    version: 1
    all: number[]
    tesla: CapacitySummary
    other: CapacitySummary
}
export function emptyCapacity(): CapacitySummary {
    return { charger_count: 0, unknown_port_station_count: 0,
        level1_count: 0, level2_count: 0, dcfast_count: 0,
        level1_ports: 0, level2_ports: 0, dcfast_ports: 0,
        tesla_count: 0, ccs_count: 0, site_masks: Array(8).fill(0) }
}
export function emptyFilterSummary(): FilterSummary {
    return { version: 1, all: Array(8).fill(0), tesla: emptyCapacity(), other: emptyCapacity() }
}
export function stationCapacity(station: Pick<Station, 'ev_connector_types' | 'charging_units' | 'charging_units_complete' |
    'port_counts_known' | 'level1_ports' | 'level2_ports' | 'dcfast_ports'>, family?: ConnectorFamily) {
    const ports = { level1: 0, level2: 0, dcfast: 0 }
    if (!family) return { ports: { level1: station.level1_ports, level2: station.level2_ports, dcfast: station.dcfast_ports }, known: station.port_counts_known, compatible: true }
    const connectors: readonly string[] = CONNECTOR_FAMILIES[family]
    const compatible = station.ev_connector_types.some(type => connectors.includes(type))
    // Missing connector metadata is an uncertainty, not proof of incompatibility.
    if (!compatible) return { ports, known: station.ev_connector_types.length > 0, compatible: station.ev_connector_types.length === 0 }
    if (station.charging_units_complete) {
        for (const unit of station.charging_units) {
            const counts = Object.entries(unit.connectors).filter(([type]) => connectors.includes(type)).map(([, count]) => count)
            // Multiple connector types on one port may overlap. Count only a
            // provable union; otherwise mark this site's allocation unknown.
            if (counts.length > 1 && Math.max(...counts) < unit.ports && counts.reduce((a, b) => a + b, 0) > Math.max(...counts)) {
                return { ports: { level1: 0, level2: 0, dcfast: 0 }, known: false, compatible: true }
            }
            ports[unit.level] += Math.min(unit.ports, Math.max(0, ...counts))
        }
        return { ports, known: true, compatible: true }
    }
    if (station.port_counts_known && station.ev_connector_types.every(type => connectors.includes(type))) {
        return { ports: { level1: station.level1_ports, level2: station.level2_ports, dcfast: station.dcfast_ports }, known: true, compatible: true }
    }
    return { ports, known: false, compatible: true }
}
function speedMask(ports: { level1: number; level2: number; dcfast: number }) {
    return SPEEDS.reduce((mask, speed, index) => mask | (ports[speed] > 0 ? 1 << index : 0), 0)
}
export function addFilterStation(summary: FilterSummary, station: Station) {
    summary.all[speedMask(stationCapacity(station).ports)]++
    for (const family of ['tesla', 'other'] as const) {
        const capacity = stationCapacity(station, family)
        if (!capacity.compatible) continue
        const target = summary[family]
        target.charger_count++
        if (!capacity.known) { target.unknown_port_station_count++; continue }
        target.site_masks[speedMask(capacity.ports)]++
        if (family === 'tesla') target.tesla_count++
        else target.ccs_count++
        for (const speed of SPEEDS) {
            target[`${speed}_ports`] += capacity.ports[speed]
            if (capacity.ports[speed] > 0) target[`${speed}_count`]++
        }
    }
}
export function selectedSiteCount(masks: number[] | undefined, selected: number): number | null {
    if (!masks || masks.length !== 8 || !masks.every(n => Number.isSafeInteger(n) && n >= 0)) return null
    return masks.reduce((total, count, mask) => total + (mask & selected ? count : 0), 0)
}

export interface PublicSupply {
    all: CapacitySummary; tesla: CapacitySummary; other: CapacitySummary
    restricted_stations: number; unknown_access_stations: number
}
export function emptyPublicSupply(): PublicSupply {
    return { all: emptyCapacity(), tesla: emptyCapacity(), other: emptyCapacity(), restricted_stations: 0, unknown_access_stations: 0 }
}
export function addPublicStation(summary: PublicSupply, station: Station) {
    if (station.restricted_access === true) { summary.restricted_stations++; return }
    if (station.restricted_access !== false) { summary.unknown_access_stations++; return }
    for (const family of [undefined, 'tesla', 'other'] as const) {
        const capacity = stationCapacity(station, family)
        if (!capacity.compatible) continue
        const target = summary[family ?? 'all']
        target.charger_count++
        if (!capacity.known) { target.unknown_port_station_count++; continue }
        target.site_masks[speedMask(capacity.ports)]++
        if (family !== 'other' && station.ev_connector_types.some(c => (CONNECTOR_FAMILIES.tesla as readonly string[]).includes(c))) target.tesla_count++
        if (family !== 'tesla' && station.ev_connector_types.some(c => (CONNECTOR_FAMILIES.other as readonly string[]).includes(c))) target.ccs_count++
        for (const speed of SPEEDS) {
            target[`${speed}_ports`] += capacity.ports[speed]
            if (capacity.ports[speed] > 0) target[`${speed}_count`]++
        }
    }
}
