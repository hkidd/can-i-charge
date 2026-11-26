import { getSupabaseAdmin } from './supabase-admin'
import { readAllPages } from './db-pagination'
import { cleanZip, type Station } from './station-model'

export interface RegionChanges {
    states: Set<string>
    /** State-wide invalidation; county assignment is rebuilt from the same snapshot. */
    counties: Set<string>
    zips: Set<string>
    total_changes: number
    added: number
    removed: number
    modified: number
}

export type ComparableStation = Partial<Station> & { id: string; state: string; zip: string | null }
function identity(station: ComparableStation): string {
    return station.source_id == null ? `legacy:${station.id}` : `afdc:${station.source_id}`
}
function fingerprint(station: ComparableStation): string {
    return JSON.stringify([
        station.name, station.address, station.latitude, station.longitude,
        station.state, cleanZip(station.zip), station.network, station.access_code,
        station.restricted_access, station.charger_type_detailed, station.num_ports,
        station.level1_ports, station.level2_ports, station.dcfast_ports, station.port_counts_known,
        [...(station.ev_connector_types ?? [])].sort(),
        station.charging_units_complete,
        (station.charging_units ?? []).map(unit => JSON.stringify([
            unit.level, unit.ports, Object.entries(unit.connectors).sort(([a], [b]) => a.localeCompare(b))
        ])).sort()
    ])
}

export function compareStations(current: ComparableStation[], previous: ComparableStation[]): RegionChanges {
    const changes: RegionChanges = { states: new Set(), counties: new Set(), zips: new Set(), total_changes: 0, added: 0, removed: 0, modified: 0 }
    const before = new Map(previous.map(station => [identity(station), station]))
    const after = new Map(current.map(station => [identity(station), station]))
    if (before.size !== previous.length || after.size !== current.length) throw new Error('Duplicate station identities in snapshot')
    const mark = (station: ComparableStation) => {
        changes.states.add(station.state)
        changes.counties.add(`${station.state}-*`)
        const zip = cleanZip(station.zip)
        if (zip) changes.zips.add(zip)
    }
    for (const [key, station] of after) {
        const old = before.get(key)
        if (!old) { changes.added++; mark(station) }
        else if (fingerprint(station) !== fingerprint(old)) { changes.modified++; mark(old); mark(station) }
    }
    for (const [key, station] of before) if (!after.has(key)) { changes.removed++; mark(station) }
    changes.total_changes = changes.added + changes.removed + changes.modified
    return changes
}

/** Compatibility entry point for internal tooling. No production-based ZIP suppression. */
export class ChangeDetector {
    static async detectChanges(useStaging = true): Promise<RegionChanges> {
        const read = (table: string) => readAllPages<ComparableStation>((from, to) =>
            getSupabaseAdmin().from(table).select('*').order('id').range(from, to))
        const [current, previous] = await Promise.all([
            read(useStaging ? 'charging_stations_staging' : 'charging_stations'),
            read(useStaging ? 'charging_stations' : 'charging_stations_previous')
        ])
        return compareStations(current, previous)
    }
}
