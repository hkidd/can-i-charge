import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
    distanceMiles, loadNearbyStations, nearbySearchBounds, summarizeNearbyStations,
    type NearbyStation
} from '@/lib/nearby-stations'

function station(id: string, milesNorth: number, overrides: Partial<NearbyStation> = {}): NearbyStation {
    return {
        id, name: `Station ${id}`, address: 'Fixture address', latitude: milesNorth / 3959 * 180 / Math.PI,
        longitude: 0, charger_type: 'level2', level1_ports: 0, level2_ports: 2, dcfast_ports: 0,
        ...overrides
    }
}

describe('nearby station distances', () => {
    it('counts distinct sites inside each radius and preserves mixed charging speeds', () => {
        const mixed = station('a', 0.5, { level1_ports: 1, dcfast_ports: 4, charger_type: 'dcfast' })
        const result = summarizeNearbyStations([
            station('outside', 10.1), station('c', 8, { dcfast_ports: 4 }), station('b', 4), mixed, mixed
        ], 0, 0)
        expect(result).toMatchObject({
            within_1_mile: 1, within_5_miles: 2, within_10_miles: 3,
            total: 3, dcfast_count: 2, level2_count: 3, level1_count: 1,
            dcfast_within_1_mile: 1, dcfast_within_5_miles: 1, dcfast_within_10_miles: 2,
            nearest: { name: 'Station a', address: 'Fixture address', type: 'dcfast' }
        })
        expect(result.nearest?.distance).toBeCloseTo(0.5)
    })

    it('excludes bounding-box corners outside the actual circle', () => {
        const corner = station('corner', 9, { longitude: 9 / 3959 * 180 / Math.PI })
        expect(summarizeNearbyStations([corner], 0, 0)).toMatchObject({ total: 0, nearest: null })
    })

    it('widens longitude bounds at high latitudes and crosses the date line', () => {
        const equator = nearbySearchBounds(0, 0).longitudeRanges[0]
        const alaska = nearbySearchBounds(65, 0).longitudeRanges[0]
        expect(alaska[1]).toBeGreaterThan(equator[1] * 2)
        const bounds = nearbySearchBounds(52, 179.99)
        expect(bounds.longitudeRanges).toHaveLength(2)
        expect(bounds.longitudeRanges[0][1]).toBe(180)
        expect(bounds.longitudeRanges[1][0]).toBe(-180)
        expect(distanceMiles(52, 179.99, 52, -179.99)).toBeLessThan(1)
    })

    it('handles identical and opposite points without invalid distances', () => {
        expect(distanceMiles(39, -105, 39, -105)).toBe(0)
        expect(distanceMiles(0, 0, 0, 180)).toBeCloseTo(3959 * Math.PI)
        expect(nearbySearchBounds(90, 0).longitudeRanges).toEqual([[-180, 180]])
    })
})

function databaseWithPages(pages: Array<{ data: NearbyStation[] | null; error: { message: string } | null }>) {
    const ranges: number[][] = []
    const query = {
        select() { return query }, eq() { return query }, gte() { return query }, lte() { return query },
        order() { return query },
        range(from: number, to: number) { ranges.push([from, to]); return query },
        abortSignal: vi.fn(() => Promise.resolve(pages.shift() ?? { data: [], error: null }))
    }
    const database = { from: () => query } as unknown as SupabaseClient
    return { database, ranges, query }
}

it('reads beyond the database response cap before reporting nearby counts', async () => {
    const { database, ranges } = databaseWithPages([
        { data: [station('a', 1)], error: null },
        { data: [station('b', 2)], error: null },
        { data: [], error: null }
    ])
    expect((await loadNearbyStations(database, 0, 0)).total).toBe(2)
    expect(ranges.map(range => range[0])).toEqual([0, 1, 2])
})

it('reports a database failure instead of zero charging sites', async () => {
    const { database } = databaseWithPages([{ data: null, error: { message: 'Fixture unavailable' } }])
    await expect(loadNearbyStations(database, 0, 0)).rejects.toThrow('Database read failed')
})
