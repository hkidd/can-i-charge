import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { calculateRegionalScore, SCORING_VERSION } from '@/lib/regional-score'
import { scoreFixture } from './fixtures/demand'
import { emptySummary } from '@/lib/region-aggregation'

const state = vi.hoisted(() => ({ region: {} as Record<string, unknown>, countError: false }))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({
    rpc() { return { abortSignal: async () => ({ data: [state.region], error: null }) } },
    from(table: string) {
        let head = false
        let below = false
        const query = {
            select(_columns: string, options?: { head?: boolean }) { head = options?.head ?? false; return query },
            gte() { return query }, lte() { return query }, eq() { return query },
            not() { return query }, limit() { return query },
            lt() { below = true; return query },
            then(resolve: (value: unknown) => void) {
                resolve(head ? {
                    data: null, count: below ? 3 : 10,
                    error: state.countError ? { message: 'Fixture count failed' } : null
                } : { data: table === 'zip_level_data' ? [state.region] : [], error: null })
            }
        }
        return query
    }
}) }))
vi.mock('@/lib/error-handling', () => ({ logError: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => ({ success: true }), getClientId: () => 'fixture' }))
vi.mock('@/lib/nearby-stations', async importOriginal => {
    const actual = await importOriginal<typeof import('@/lib/nearby-stations')>()
    return { ...actual, loadNearbyStations: async () => actual.summarizeNearbyStations([], 39, -105) }
})
import { GET } from '@/app/api/ev-score/route'

beforeEach(() => {
    state.countError = false
    state.region = {
        ...emptySummary(), ...scoreFixture(), population: 10000, charger_count: 10, level2_count: 8, dcfast_count: 2,
        level2_ports: 20, dcfast_ports: 10, total_ports: 30, tesla_count: 2, ccs_count: 8,
        center_lat: 39, center_lng: -105, zip_code: '80000', state: 'CO'
    }
})

async function responseBody() {
    const response = await GET(new NextRequest('https://fixture.invalid/api/ev-score?lat=39&lng=-105'))
    expect(response.status).toBe(200)
    return response.json()
}

it('returns the shared regional score while keeping nearby station facts separate', async () => {
    const response = await responseBody()
    expect(response).toMatchObject({
        ...calculateRegionalScore(state.region), scoring_version: SCORING_VERSION, percentile: null,
        chargers: { total: 0, within_5_miles: 0, nearest: null }, nearest_charger_miles: null
    })
})

it('returns unrated rather than a failing grade when population is missing', async () => {
    state.region.population = null
    expect(await responseBody()).toMatchObject({ score: null, breakdown: null, grade: 'Unrated', percentile: null })
})

it('keeps peer rankings out of the absolute readiness response', async () => {
    state.countError = true
    expect(await responseBody()).toMatchObject({ score: 100, percentile: null })
})
