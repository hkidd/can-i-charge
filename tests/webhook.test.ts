import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'

const effects = vi.hoisted(() => ({ apply: vi.fn() }))
vi.mock('@/lib/subscription-access', async importOriginal => ({
    ...await importOriginal<typeof import('@/lib/subscription-access')>(),
    applySubscriptionEvent: effects.apply
}))
vi.mock('server-only', () => ({}))
import { POST } from '@/app/api/webhooks/polar/route'

const secret = 'local-webhook-test-secret'
const payload = JSON.stringify({
    type: 'customer.deleted', timestamp: new Date().toISOString(),
    data: {
        id: 'fixture-customer', created_at: '2026-01-01T00:00:00Z', modified_at: null,
        metadata: {}, external_id: null, email: 'fixture@example.invalid', email_verified: true,
        name: null, billing_address: null, tax_id: null, organization_id: 'fixture-org',
        deleted_at: '2026-01-02T00:00:00Z', avatar_url: ''
    }
})

function signedRequest(body = payload, signedBody = body, timestamp = new Date()) {
    const id = 'fixture-event'
    const time = String(Math.floor(timestamp.getTime() / 1000))
    const signature = 'v1,' + createHmac('sha256', secret).update(`${id}.${time}.${signedBody}`).digest('base64')
    return new NextRequest('https://local.test/api/webhooks/polar', {
        method: 'POST', body,
        headers: {
            'webhook-id': id, 'webhook-timestamp': time,
            'webhook-signature': signature
        }
    })
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('POLAR_WEBHOOK_SECRET', secret)
    vi.stubEnv('POLAR_PRODUCT_ID', 'fixture-product')
    vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('Polar webhook verification', () => {
    it('accepts a correctly signed, schema-valid provider event', async () => {
        const response = await POST(signedRequest())
        expect(response.status).toBe(200)
    })

    it('rejects missing credentials before any subscription side effects', async () => {
        const response = await POST(new NextRequest('https://local.test', { method: 'POST', body: payload }))
        expect(response.status).toBe(401)
        for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled()
    })

    it('requires a configured secret', async () => {
        vi.stubEnv('POLAR_WEBHOOK_SECRET', '')
        expect((await POST(signedRequest())).status).toBe(503)
        for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled()
    })

    it('rejects changed bodies and expired signatures', async () => {
        expect((await POST(signedRequest(payload + ' ', payload))).status).toBe(401)
        expect((await POST(signedRequest(payload, payload, new Date(Date.now() - 3600000)))).status).toBe(401)
        for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled()
    })

    it('rejects a signed event with an invalid provider schema', async () => {
        expect((await POST(signedRequest('{"type":"subscription.active","data":{}}'))).status).toBe(400)
        for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled()
    })

    it('processes the current SDK subscription fields after verification', async () => {
        effects.apply.mockResolvedValue(undefined)
        const timestamp = new Date().toISOString()
        const body = JSON.stringify({ type: 'subscription.active', timestamp, data: {
            id: 'fixture-subscription', product_id: 'fixture-product', status: 'active', customer_id: 'fixture-customer',
            customer: { email: 'fixture@example.invalid' }
        } })
        expect((await POST(signedRequest(body))).status).toBe(200)
        expect(effects.apply).toHaveBeenCalledExactlyOnceWith('subscription.active', timestamp, {
            id: 'fixture-subscription', product_id: 'fixture-product', status: 'active', customer_id: 'fixture-customer',
            customer: { email: 'fixture@example.invalid' }
        })
    })

    it('asks the provider to retry after subscription persistence fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        effects.apply.mockRejectedValue(new Error('Fixture persistence error'))
        const body = JSON.stringify({ type: 'subscription.active', timestamp: new Date().toISOString(), data: {
            id: 'fixture-subscription', product_id: 'fixture-product', status: 'active', customer_id: 'fixture-customer',
            customer: { email: 'fixture@example.invalid' }
        } })
        expect((await POST(signedRequest(body))).status).toBe(500)
    })
})
