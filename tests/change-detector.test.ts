import { expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: vi.fn() }))
import { compareStations } from '@/lib/change-detector'
import { processNRELStation } from '@/lib/station-model'
const station = processNRELStation({ id: 1, station_name: 'Fixture', latitude: 40, longitude: -105, state: 'CO', zip: '08000', ev_level2_evse_num: 2, ev_connector_types: ['TESLA','J1772'] })
it('detects port-only changes and invalidates counties and ZIPs', () => {
    const result = compareStations([{ ...station, level2_ports: 20, num_ports: 20 }], [station])
    expect(result.modified).toBe(1)
    expect([...result.zips]).toEqual(['08000'])
    expect([...result.counties]).toEqual(['CO-*'])
})
it('marks old and new regions after a move or removal', () => {
    const result = compareStations([{ ...station, state: 'WY', zip: '82001' }], [station])
    expect([...result.states].sort()).toEqual(['CO','WY'])
    expect([...result.zips].sort()).toEqual(['08000','82001'])
    expect(compareStations([], [station]).removed).toBe(1)
})
it('ignores generated row IDs and connector ordering when source identity is stable', () => {
    expect(compareStations([{ ...station, id: 'another-row', ev_connector_types: ['J1772','TESLA'] }], [station]).total_changes).toBe(0)
})
it('does not suppress a newly added station in a previously unchanged ZIP', () => {
    const result = compareStations([station, { ...station, id: 'second', source_id: 2 }], [station])
    expect(result.added).toBe(1)
    expect([...result.zips]).toEqual(['08000'])
})
it('rejects ambiguous duplicate source identities', () => {
    expect(() => compareStations([station, station], [])).toThrow('Duplicate station identities')
})
