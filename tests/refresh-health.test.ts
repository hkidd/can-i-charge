import { afterEach, expect, it, vi } from 'vitest'
const fixtures = vi.hoisted(() => ({ active: false, published: { completed_at: '', station_count: 100000 } as { completed_at: string; station_count: number } | null }))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ from: (table: string) => {
    let isActive = false
    const query = {
        select() { return query }, eq() { return query }, order() { return query },
        limit() { return query }, in() { isActive = true; return query }, gt() { return query },
        maybeSingle() { return query }, abortSignal() { return query },
        then(resolve: (value: unknown) => void) { resolve({ data: table === 'charging_stations' ? [{ id: 'fixture' }] : isActive ? fixtures.active ? { id: 'active' } : null : fixtures.published, error: null }) }
    }
    return query
} }) }))
import { GET } from '@/app/api/health/route'
afterEach(() => vi.useRealTimers())
it('reports healthy only after a recent successful publication', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-23T12:00:00Z'))
    fixtures.published = { completed_at: '2026-11-23T03:30:00Z', station_count: 100000 }
    expect((await GET()).status).toBe(200)
})
it('does not mistake a reachable database for current station data', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-23T12:00:00Z'))
    fixtures.published = { completed_at: '2026-11-20T03:30:00Z', station_count: 100000 }
    const response = await GET()
    expect(response.status).toBe(503)
    expect((await response.json()).checks.refresh.status).toBe('stale')
    fixtures.published = null
    expect((await GET()).status).toBe(503)
})

it('announces an active refresh while continuing to serve the previous fresh snapshot', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-23T12:00:00Z'))
    fixtures.published = { completed_at: '2026-11-23T03:30:00Z', station_count: 100000 }
    fixtures.active = true
    const response = await GET()
    expect(response.status).toBe(200)
    expect((await response.json()).maintenance.active).toBe(true)
    fixtures.active = false
})
