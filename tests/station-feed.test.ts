import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: vi.fn() }))
import { readStationFeed } from '@/lib/station-feed'
const station = { id: 1, station_name: 'Fixture', latitude: 40, longitude: -105, state: 'CO', zip: '80000', ev_level2_evse_num: 2 }
function response(text: string) {
    return new Response(new ReadableStream({
        start(controller) {
            const bytes = new TextEncoder().encode(text)
            for (let offset = 0; offset < bytes.length; offset += 7) controller.enqueue(bytes.slice(offset, offset + 7))
            controller.close()
        }
    }), { headers: { 'content-type': 'application/json' } })
}
it('streams national feed records across arbitrary chunk boundaries', async () => {
    const result = await readStationFeed(response(JSON.stringify({ fuel_stations: [station, { ...station, id: 2 }] })), 1)
    expect(result.stations.map(row => row.source_id)).toEqual([1, 2])
    expect(result.received).toBe(2)
})
it('rejects incomplete JSON, duplicates, empty feeds and excessive bad records', async () => {
    for (const body of ['{"fuel_stations":[', JSON.stringify({ fuel_stations: [station, station] }),
        JSON.stringify({ fuel_stations: [] }), JSON.stringify({ fuel_stations: [station, { ...station, id: 2, latitude: null }] })]) {
        await expect(readStationFeed(response(body), 1)).rejects.toThrow()
    }
})

it('checks the provider result count before accepting a valid but incomplete JSON payload', async () => {
    const full = response(JSON.stringify({ total_results: 1, fuel_stations: [station] }))
    expect((await readStationFeed(full, 1, true)).stations).toHaveLength(1)
    const partial = response(JSON.stringify({ metadata: { total_results: 2 }, fuel_stations: [station] }))
    await expect(readStationFeed(partial, 1, true)).rejects.toThrow('incomplete result set')
    await expect(readStationFeed(response(JSON.stringify({ fuel_stations: [station] })), 1, true)).rejects.toThrow('incomplete result set')
})

it('preserves production when a feed loses nearly all capacity information', async () => {
    const unknown = { ...station, ev_level2_evse_num: null }
    await expect(readStationFeed(response(JSON.stringify({ fuel_stations: [unknown] })), 1)).rejects.toThrow('quality checks')
})
