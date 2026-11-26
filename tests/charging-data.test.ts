import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const fixtures = vi.hoisted(() => ({
    rows: {} as Record<string, Record<string, unknown>[]>,
    fail: false,
    reads: [] as string[]
}))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => {
    function query(table: string) {
        let offset = 0
        let codes: string[] | undefined
        const builder = {
            select() { return builder }, gte() { return builder }, lte() { return builder },
            order() { return builder },
            in(_column: string, values: string[]) { codes = values; return builder },
            range(from: number) { offset = from; return builder },
            abortSignal() {
                fixtures.reads.push(table)
                const rows = (fixtures.rows[table] ?? []).filter(row => !codes || codes.includes(String(row.zip_code)))
                // Simulate a server cap smaller than the requested page size.
                return Promise.resolve({
                    data: fixtures.fail ? null : rows.slice(offset, offset + 1),
                    error: fixtures.fail ? { message: 'Private fixture database detail' } : null
                })
            }
        }
        return builder
    }
    return { from: query, rpc: query }
} }))
vi.mock('@/lib/error-handling', () => ({ logError: vi.fn() }))
import { GET } from '@/app/api/charging-data/route'

beforeEach(() => { fixtures.rows = {}; fixtures.fail = false; fixtures.reads = [] })

it('joins current scoring columns to legacy geometry results and reads every page', async () => {
    const geometry = { type: 'Polygon', coordinates: [] }
    fixtures.rows.get_zip_data_with_geometry = [
        { zip_code: '80000', charger_count: 999, geometry },
        { zip_code: '80001', charger_count: 999, geometry }
    ]
    fixtures.rows.zip_level_data = [
        { zip_code: '80000', charger_count: 2, dcfast_ports: 8, unknown_port_station_count: 0, scoring_version: 'regional-v2' },
        { zip_code: '80001', charger_count: 3, dcfast_ports: 10, unknown_port_station_count: 0, scoring_version: 'regional-v2' }
    ]
    const response = await GET(new NextRequest('https://fixture.invalid/api/charging-data?zoom=10'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.count).toBe(2)
    expect(body.data.map((row: { charger_count: number }) => row.charger_count)).toEqual([2, 3])
    expect(body.data[0]).toMatchObject({ dcfast_ports: 8, scoring_version: 'regional-v2', geometry })
    expect(fixtures.reads.filter(table => table === 'get_zip_data_with_geometry')).toHaveLength(3)
    expect(fixtures.reads.filter(table => table === 'zip_level_data')).toHaveLength(3)
})

it('returns all county rows despite the response cap', async () => {
    fixtures.rows.county_level_data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const response = await GET(new NextRequest('https://fixture.invalid/api/charging-data?zoom=8'))
    expect(await response.json()).toMatchObject({ count: 3, data: fixtures.rows.county_level_data })
})

it('returns a service error without exposing database details', async () => {
    fixtures.fail = true
    const response = await GET(new NextRequest('https://fixture.invalid/api/charging-data?zoom=8'))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('Private fixture')
})

it('rejects a geometry result without its matching regional summary', async () => {
    fixtures.rows.get_zip_data_with_geometry = [{ zip_code: '80000', geometry: {} }]
    const response = await GET(new NextRequest('https://fixture.invalid/api/charging-data?zoom=10'))
    expect(response.status).toBe(503)
})
