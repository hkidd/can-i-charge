import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveScoreLocation } from '@/lib/score-location'

function fixtureDatabase(rows: Record<string, Record<string, unknown>[]>, zipResult = {
    data: [] as Record<string, unknown>[], error: null as { code: string; message: string } | null
}) {
    const rpc = vi.fn(() => ({ abortSignal: async () => zipResult }))
    const from = vi.fn((table: string) => {
        const conditions: Array<[string, unknown]> = []
        const query = {
            select() { return query },
            eq(column: string, value: unknown) { conditions.push([column, value]); return query },
            abortSignal() { return query },
            async maybeSingle() {
                return { data: rows[table]?.find(row => conditions.every(([key, value]) => row[key] === value)) ?? null, error: null }
            }
        }
        return query
    })
    return { database: { rpc, from } as unknown as SupabaseClient, rpc, from }
}

const denver = { county_fips: '08031', county_name: 'Denver', state: 'CO', center_lat: 39.739, center_lng: -104.99 }
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

it('retains an explicitly requested ZIP and its leading zero', async () => {
    const row = { zip_code: '07001', state: 'NJ', center_lat: 40.58, center_lng: -74.27 }
    const { database, rpc } = fixtureDatabase({ zip_level_data: [row] })
    const result = await resolveScoreLocation(new URLSearchParams({ zip: '07001' }), () => database)
    expect(result).toMatchObject({ data: row, type: 'zip', match: 'requested_region', centerDistance: 0 })
    expect(rpc).not.toHaveBeenCalled()
})

it.each(['CO', 'Colorado', 'colorado'])('supports explicit state lookup by %s', async state => {
    const row = { state_name: 'Colorado', center_lat: 39, center_lng: -105 }
    const { database } = fixtureDatabase({ state_level_data: [row] })
    expect(await resolveScoreLocation(new URLSearchParams({ state }), () => database)).toMatchObject({ data: row, type: 'state' })
})

it('resolves an explicit county name without wildcard matching or choosing another center', async () => {
    const { database } = fixtureDatabase({ county_level_data: [denver] })
    expect(await resolveScoreLocation(new URLSearchParams({ county: 'denver County', state: 'Colorado' }), () => database))
        .toMatchObject({ data: denver, type: 'county', match: 'requested_region' })
})

it('uses a containing ZIP even when its center is far from the requested point', async () => {
    const row = { zip_code: '80000', center_lat: 40.5, center_lng: -105.5 }
    const { database, from } = fixtureDatabase({}, { data: [row], error: null })
    const result = await resolveScoreLocation(new URLSearchParams({ lat: '39.739', lng: '-104.99' }), () => database)
    expect(result).toMatchObject({ data: row, type: 'zip', match: 'boundary', lat: 39.739, lng: -104.99 })
    expect(result.centerDistance).toBeGreaterThan(10)
    expect(from).not.toHaveBeenCalled()
})

it('falls back to the containing county when optional ZIP geometry is unavailable', async () => {
    const { database } = fixtureDatabase({ county_level_data: [denver] }, {
        data: [], error: { code: 'PGRST202', message: 'Function missing' }
    })
    expect(await resolveScoreLocation(new URLSearchParams({ lat: '39.739', lng: '-104.99' }), () => database))
        .toMatchObject({ data: denver, type: 'county', match: 'boundary' })
})

it('does not substitute a nearby US center for a point in Canada', async () => {
    const { database } = fixtureDatabase({ county_level_data: [denver] })
    await expect(resolveScoreLocation(new URLSearchParams({ lat: '49.2827', lng: '-123.1207' }), () => database))
        .rejects.toMatchObject({ status: 404 })
})

it('propagates a ZIP database outage instead of hiding it as a county fallback', async () => {
    const { database } = fixtureDatabase({ county_level_data: [denver] }, {
        data: [], error: { code: '08006', message: 'Connection unavailable' }
    })
    await expect(resolveScoreLocation(new URLSearchParams({ lat: '39.739', lng: '-104.99' }), () => database))
        .rejects.toMatchObject({ status: 503 })
})

it.each(['zip=7001', 'county=Denver', 'state=Invalid', 'zip=07001&lat=40&lng=-74'])
('rejects incomplete or ambiguous region input: %s', async params => {
    const getDatabase = vi.fn()
    await expect(resolveScoreLocation(new URLSearchParams(params), getDatabase)).rejects.toMatchObject({ status: 400 })
    expect(getDatabase).not.toHaveBeenCalled()
})

it('returns a service error when the geocoding provider fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'fixture-token')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })))
    const { database } = fixtureDatabase({})
    await expect(resolveScoreLocation(new URLSearchParams({ address: 'Fixture address' }), () => database))
        .rejects.toMatchObject({ status: 503 })
})
