import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { requireRefreshAuthorization } from '@/lib/refresh-auth'

const services = vi.hoisted(() => ({ stage: vi.fn(), publish: vi.fn() }))
vi.mock('@/lib/refresh-service', () => ({ stageStationRefresh: services.stage, publishStagedRefresh: services.publish }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: vi.fn() }))

import * as refresh from '@/app/api/refresh-data/route'
import * as smart from '@/app/api/smart-update/route'
import * as daily from '@/app/api/cron/daily-refresh/route'
import * as trigger from '@/app/api/cron/trigger/route'

const routes = [
    ['refresh POST', refresh.POST], ['refresh GET', refresh.GET],
    ['smart POST', smart.POST], ['smart GET', smart.GET],
    ['daily GET', daily.GET], ['trigger POST', trigger.POST], ['trigger GET', trigger.GET]
] as const

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'local-test-secret')
    vi.stubEnv('NREL_API_KEY', 'local-test-key')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('refresh authorization', () => {
    it('accepts the configured credential', () => {
        const request = new Request('https://local.test', { headers: { authorization: 'Bearer local-test-secret' } })
        expect(requireRefreshAuthorization(request)).toBeNull()
    })

    for (const [name, handler] of routes) {
        it(`${name} rejects unverified requests without starting work`, async () => {
            const rejectedHeaders: HeadersInit[] = [{}, { authorization: 'Bearer invalid' }, { 'x-admin-request': 'true' }]
            for (const headers of rejectedHeaders) {
                const response = await handler(new NextRequest('https://local.test/api/job', { headers }))
                expect(response.status).toBe(401)
                expect(response.headers.get('cache-control')).toContain('no-store')
            }
            expect(fetch).not.toHaveBeenCalled()
            for (const service of Object.values(services)) expect(service).not.toHaveBeenCalled()
        })

        it(`${name} is unavailable when its secret is not configured`, async () => {
            for (const secret of [undefined, '', '   ']) {
                vi.stubEnv('CRON_SECRET', secret)
                const response = await handler(new NextRequest('https://local.test/api/job'))
                expect(response.status).toBe(503)
            }
            expect(fetch).not.toHaveBeenCalled()
            for (const service of Object.values(services)) expect(service).not.toHaveBeenCalled()
        })
    }

    it('allows an authenticated smart-update request to reach the service', async () => {
        services.publish.mockResolvedValue({ success: true })
        const response = await smart.POST(new NextRequest('https://local.test/api/smart-update', {
            method: 'POST', headers: { authorization: 'Bearer local-test-secret' }, body: '{}'
        }))
        expect(response.status).toBe(200)
        expect(services.publish).toHaveBeenCalledWith(undefined)
    })
    it('rejects partial and direct-production updates before starting work', async () => {
        for (const body of [{ levels: ['states'] }, { useStaging: false }, { run_id: 'invalid' }]) {
            const response = await smart.POST(new NextRequest('https://local.test/api/smart-update', {
                method: 'POST', headers: { authorization: 'Bearer local-test-secret' }, body: JSON.stringify(body)
            }))
            expect(response.status).toBe(400)
        }
        expect(services.publish).not.toHaveBeenCalled()
    })
    it('passes the exact staged run to publication without self-HTTP requests', async () => {
        const id = '00000000-0000-4000-8000-000000000001'
        services.stage.mockResolvedValue({ success: true, run_id: id })
        services.publish.mockResolvedValue({ success: true, swap_performed: true })
        const response = await daily.GET(new NextRequest('https://local.test/api/cron/daily-refresh', {
            headers: { authorization: 'Bearer local-test-secret' }
        }))
        expect(response.status).toBe(200)
        expect(services.publish.mock.calls[0][0]).toBe(id)
        expect(fetch).not.toHaveBeenCalled()
    })
})
