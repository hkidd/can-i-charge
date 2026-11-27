import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const effects = vi.hoisted(() => ({ rpc: vi.fn(), email: vi.fn() }))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ rpc: effects.rpc }) }))
vi.mock('@/lib/api-keys', () => ({ generateApiKey: () => 'new-fixture-key' }))
vi.mock('@/lib/email', () => ({ sendApiKeyEmail: effects.email }))
import { applySubscriptionEvent, subscriptionHasAccess } from '@/lib/subscription-access'

const subscription = { id: 'sub', product_id: 'fixture-product', status: 'active' as const, customer_id: 'customer', customer: { email: 'fixture@example.invalid' } }
beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('POLAR_PRODUCT_ID', 'fixture-product')
    effects.rpc.mockImplementation((name: string) => ({ abortSignal: async () => ({
        data: name === 'apply_subscription_access' ? { api_key: 'existing-fixture-key', send_email: true, stale: false } : null,
        error: null
    }) }))
    effects.email.mockResolvedValue({ success: true })
})

afterEach(() => vi.unstubAllEnvs())

it('retains access for a scheduled cancellation until the period ends', () => {
    expect(subscriptionHasAccess({
        ...subscription, status: 'canceled', cancel_at_period_end: true,
        current_period_end: new Date(Date.now() + 3600000).toISOString()
    }, 'subscription.canceled')).toBe(true)
    expect(subscriptionHasAccess({ ...subscription, ended_at: new Date().toISOString() }, 'subscription.updated')).toBe(false)
    expect(subscriptionHasAccess(subscription, 'subscription.revoked')).toBe(false)
    expect(subscriptionHasAccess({ ...subscription, status: 'incomplete' }, 'subscription.created')).toBe(false)
})

it('sends the persisted key with an email idempotency key before recording delivery', async () => {
    await applySubscriptionEvent('subscription.active', '2026-11-23T12:00:00Z', subscription)
    expect(effects.email).toHaveBeenCalledExactlyOnceWith({
        to: 'fixture@example.invalid', apiKey: 'existing-fixture-key', idempotencyKey: 'subscription-welcome/sub'
    })
    expect(effects.rpc).toHaveBeenLastCalledWith('mark_subscription_email_sent', {
        p_subscription_id: 'sub', p_api_key: 'existing-fixture-key'
    })
})

it('leaves failed email delivery retryable', async () => {
    effects.email.mockResolvedValue({ success: false })
    await expect(applySubscriptionEvent('subscription.active', '2026-11-23T12:00:00Z', subscription)).rejects.toThrow('delivery failed')
    expect(effects.rpc).toHaveBeenCalledTimes(1)
})

it('does not email stale events or already completed deliveries', async () => {
    effects.rpc.mockReturnValue({ abortSignal: async () => ({
        data: { api_key: null, send_email: false, stale: true }, error: null
    }) })
    await applySubscriptionEvent('subscription.active', '2026-11-23T12:00:00Z', subscription)
    expect(effects.email).not.toHaveBeenCalled()
})

it('does not grant access for another product', async () => {
    await applySubscriptionEvent('subscription.active', '2026-11-23T12:00:00Z', {
        ...subscription, product_id: 'other-product'
    })
    expect(effects.rpc.mock.calls[0][1].p_active).toBe(false)
})
