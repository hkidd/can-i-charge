import { describe, expect, it } from 'vitest'
import { cleanZip, processNRELStation, stationId } from '@/lib/station-model'

export const sourceStation = {
    id: 100, station_name: 'Fixture', latitude: 40, longitude: -105,
    street_address: '123 Fixture Road', city: 'Fixture', state: 'CO', zip: '08000-1234',
    country: 'US', access_code: 'public', status_code: 'E',
    ev_connector_types: ['TESLA'], ev_level2_evse_num: 12, ev_dc_fast_num: 0
}

describe('station normalization', () => {
    it('keeps Tesla Level 2 stations as Level 2', () => {
        const result = processNRELStation(sourceStation)
        expect(result.charger_type).toBe('level2')
        expect(result.num_ports).toBe(12)
        expect(result.source_id).toBe(100)
        expect(result.zip).toBe('08000')
    })
    it('preserves every speed at mixed sites and keeps a stable source-based UUID', () => {
        const first = processNRELStation({ ...sourceStation, ev_dc_fast_num: 2, ev_level1_evse_num: 1 })
        const moved = processNRELStation({ ...sourceStation, station_name: 'Renamed', latitude: 41 })
        expect(first.num_ports).toBe(15)
        expect([first.level1_ports, first.level2_ports, first.dcfast_ports]).toEqual([1, 12, 2])
        expect(first.id).toBe(moved.id)
        expect(first.id).not.toBe(stationId(101))
    })
    it('does not invent one port or infer speed from connector branding', () => {
        const result = processNRELStation({ ...sourceStation, ev_level2_evse_num: null, ev_dc_fast_num: null })
        expect(result.num_ports).toBeNull()
        expect(result.charger_type).toBeNull()
        expect(result.port_counts_known).toBe(false)
        const zero = processNRELStation({ ...sourceStation, ev_level2_evse_num: 0 })
        expect(zero.num_ports).toBe(0)
    })
    it('validates coordinates and counts and excludes unavailable or private sites', () => {
        for (const patch of [{ latitude: NaN }, { longitude: 190 }, { ev_dc_fast_num: -1 }, { ev_level2_evse_num: 1.5 }, { access_code: 'private' }, { status_code: 'P' }, { fuel_type_code: 'E85' }]) {
            expect(() => processNRELStation({ ...sourceStation, ...patch })).toThrow()
        }
    })
    it('normalizes connector order and distinguishes complete unit metadata', () => {
        const result = processNRELStation({ ...sourceStation, ev_level2_evse_num: 2,
            ev_connector_types: ['TESLA','TESLA','J1772'],
            ev_charging_units: [{ charging_level: 'level2', port_count: 2, connectors: { TESLA: { port_count: 2 } } }]
        })
        expect(result.ev_connector_types).toEqual(['J1772','TESLA'])
        expect(result.charging_units_complete).toBe(true)
        expect(processNRELStation({ ...sourceStation, ev_charging_units: [] }).charging_units_complete).toBe(false)
    })
    it('retains leading zeros and rejects malformed ZIP codes', () => {
        expect(cleanZip(' 00123-1234 ')).toBe('00123')
        expect(cleanZip('1234')).toBeNull()
        expect(cleanZip('12345-junk')).toBeNull()
        expect(cleanZip(null)).toBeNull()
    })
})
