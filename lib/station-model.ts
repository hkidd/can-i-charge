import { createHash } from 'node:crypto'
import { z } from 'zod'
import { US_STATES } from './us-states'

export type ChargingLevel = 'level1' | 'level2' | 'dcfast'
export interface ChargingUnit {
    level: ChargingLevel
    ports: number
    connectors: Record<string, number>
}
export interface Station {
    id: string
    source_id: number
    name: string
    latitude: number
    longitude: number
    address: string
    zip: string | null
    state: string
    network: string
    access_code: 'public'
    restricted_access: boolean | null
    charger_type: ChargingLevel | null
    charger_type_detailed: ChargingLevel | null
    num_ports: number | null
    level1_ports: number
    level2_ports: number
    dcfast_ports: number
    port_counts_known: boolean
    ev_connector_types: string[]
    charging_units: ChargingUnit[]
    charging_units_complete: boolean
}

const portCount = z.number().int().min(0).max(100000).nullish()
const sourceSchema = z.object({
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    station_name: z.string().trim().min(1),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    street_address: z.string().nullish(), city: z.string().nullish(),
    state: z.string().trim().length(2).transform(value => value.toUpperCase()),
    zip: z.string().nullish(), country: z.string().optional(), fuel_type_code: z.string().optional(),
    status_code: z.string().optional(), access_code: z.string().optional(),
    restricted_access: z.boolean().nullish(), ev_network: z.string().nullish(),
    ev_connector_types: z.array(z.string()).nullish(),
    ev_level1_evse_num: portCount, ev_level2_evse_num: portCount, ev_dc_fast_num: portCount,
    ev_charging_units: z.array(z.unknown()).nullish()
})
export type NRELStation = z.input<typeof sourceSchema>
const stateCodes = new Set<string>(US_STATES.map(state => state.code))

/** Stable UUIDv8 identity, independent of row order, coordinates, and display name. */
export function stationId(sourceId: number): string {
    const bytes = createHash('sha256').update(`can-i-charge:afdc:${sourceId}`).digest().subarray(0, 16)
    bytes[6] = (bytes[6] & 15) | 128
    bytes[8] = (bytes[8] & 63) | 128
    const hex = bytes.toString('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function cleanZip(value: string | null | undefined): string | null {
    const match = value?.trim().match(/^(\d{5})(?:-\d{4})?$/)
    return match?.[1] ?? null
}

const unitSchema = z.object({
    charging_level: z.enum(['1', '2', 'level1', 'level2', 'dc_fast']),
    port_count: z.number().int().positive(),
    connectors: z.record(z.string(), z.object({ port_count: z.number().int().nonnegative() }))
})

export function processNRELStation(input: unknown): Station {
    const source = sourceSchema.parse(input)
    if (!stateCodes.has(source.state) || (source.fuel_type_code && source.fuel_type_code !== 'ELEC') || (source.country && source.country !== 'US') ||
        (source.status_code && source.status_code !== 'E') ||
        (source.access_code && source.access_code !== 'public')) {
        throw new Error('Station is outside the public, available US coverage policy')
    }
    const level1 = source.ev_level1_evse_num ?? 0
    const level2 = source.ev_level2_evse_num ?? 0
    const dcfast = source.ev_dc_fast_num ?? 0
    const known = [source.ev_level1_evse_num, source.ev_level2_evse_num, source.ev_dc_fast_num].some(value => value != null)
    const level = dcfast > 0 ? 'dcfast' : level2 > 0 ? 'level2' : level1 > 0 ? 'level1' : null
    const units: ChargingUnit[] = []
    for (const raw of source.ev_charging_units ?? []) {
        const parsed = unitSchema.safeParse(raw)
        if (!parsed.success) continue
        units.push({
            level: parsed.data.charging_level === 'dc_fast' ? 'dcfast' :
                parsed.data.charging_level === '1' || parsed.data.charging_level === 'level1' ? 'level1' : 'level2',
            ports: parsed.data.port_count,
            connectors: Object.fromEntries(Object.entries(parsed.data.connectors)
                .filter(([, value]) => value.port_count > 0).map(([type, value]) => [type, value.port_count]))
        })
    }
    const unitPorts = { level1: 0, level2: 0, dcfast: 0 }
    for (const unit of units) unitPorts[unit.level] += unit.ports
    return {
        id: stationId(source.id), source_id: source.id,
        name: source.station_name, latitude: source.latitude, longitude: source.longitude,
        address: [source.street_address, source.city, source.state, source.zip].filter(Boolean).join(', '),
        zip: cleanZip(source.zip), state: source.state, network: source.ev_network?.trim() || 'Unknown',
        access_code: 'public', restricted_access: source.restricted_access ?? null,
        charger_type: level, charger_type_detailed: level,
        num_ports: known ? level1 + level2 + dcfast : null,
        level1_ports: level1, level2_ports: level2, dcfast_ports: dcfast, port_counts_known: known,
        ev_connector_types: [...new Set([...(source.ev_connector_types ?? []), ...units.flatMap(unit => Object.keys(unit.connectors))])].sort(),
        charging_units: units,
        charging_units_complete: known && units.length > 0 && units.length === source.ev_charging_units?.length && unitPorts.level1 === level1 &&
            unitPorts.level2 === level2 && unitPorts.dcfast === dcfast
    }
}
