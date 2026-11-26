import { afterEach, expect, it, vi } from 'vitest'

const createClient = vi.hoisted(() => vi.fn(() => ({ from: vi.fn() })))
vi.mock('server-only', () => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.clearAllMocks() })

it('requires a service credential rather than falling back to the public key', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-fixture')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', undefined)
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
    expect(() => getSupabaseAdmin()).toThrow('Server database credentials are not configured')
    expect(createClient).not.toHaveBeenCalled()
})

it('creates a server client once, with session persistence disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-fixture')
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
    expect(getSupabaseAdmin()).toBe(getSupabaseAdmin())
    expect(createClient).toHaveBeenCalledExactlyOnceWith('https://fixture.supabase.co', 'server-fixture', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
})
