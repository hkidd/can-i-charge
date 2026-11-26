import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const effects = vi.hoisted(() => ({ validate: vi.fn(), rateLimit: vi.fn(), resolve: vi.fn() }))
vi.mock('@/lib/api-keys', () => ({ validateApiKey: effects.validate }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: effects.rateLimit, getClientId: () => 'fixture' }))
vi.mock('@/lib/score-location', async importOriginal => ({
    ...await importOriginal<typeof import('@/lib/score-location')>(), resolveScoreLocation: effects.resolve
}))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({}) }))
vi.mock('@/lib/error-handling', () => ({ logError: vi.fn() }))
vi.mock('@/lib/nearby-stations', async importOriginal => {
    const actual = await importOriginal<typeof import('@/lib/nearby-stations')>()
    return { ...actual, loadNearbyStations: async () => actual.summarizeNearbyStations([], 39, -105) }
})
import { GET } from '@/app/api/ev-score/route'

const key = 'cic_live_' + 'a'.repeat(32)
function request(authorization?: string) {
    return new NextRequest('https://fixture.invalid/api/ev-score?lat=39&lng=-105', {
        headers: authorization ? { Authorization: authorization } : {}
    })
}
beforeEach(() => {
    vi.resetAllMocks()
    effects.validate.mockResolvedValue({ valid: true, remainingRequests: 999 })
    effects.rateLimit.mockReturnValue({ success: true })
    effects.resolve.mockResolvedValue({
        lat: 39, lng: -105, address: '', data: { population: null },
        type: 'county', match: 'boundary', name: 'Fixture', centerDistance: 0
    })
})

it('uses the persistent key quota and exposes its remaining count', async () => {
    const response = await GET(request(`Bearer ${key}`))
    expect(response.status).toBe(200)
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('999')
    expect(effects.validate).toHaveBeenCalledExactlyOnceWith(key)
    expect(effects.rateLimit).not.toHaveBeenCalled()
})

it.each([['invalid', 401], ['quota', 429], ['unavailable', 503]] as const)
('does not downgrade a rejected key to anonymous access: %s', async (reason, status) => {
    effects.validate.mockResolvedValue({ valid: false, reason })
    expect((await GET(request(`Bearer ${key}`))).status).toBe(status)
    expect(effects.resolve).not.toHaveBeenCalled()
    expect(effects.rateLimit).not.toHaveBeenCalled()
})

it('rejects malformed authorization before touching the quota service', async () => {
    expect((await GET(request('Bearer invalid'))).status).toBe(401)
    expect(effects.validate).not.toHaveBeenCalled()
})

it('retains the public endpoint with its basic anonymous rate limit', async () => {
    expect((await GET(request())).status).toBe(200)
    expect(effects.rateLimit).toHaveBeenCalledOnce()
    expect(effects.validate).not.toHaveBeenCalled()
})
