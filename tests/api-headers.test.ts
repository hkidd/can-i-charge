import { expect, it, vi } from 'vitest'
import type { NextConfig } from 'next'

vi.mock('@sentry/nextjs/config', () => ({ withSentryConfig: (config: NextConfig) => config }))
import config from '../next.config'

it('defaults API responses to private, uncached responses', async () => {
    const rules = await config.headers!()
    const api = rules.find(rule => rule.source === '/api/(.*)')!
    expect(api.headers).toContainEqual({ key: 'Cache-Control', value: 'private, no-store' })
    expect(api.headers.some(header => header.key === 'Access-Control-Allow-Origin')).toBe(false)
})

it('allows widget reads without enabling cross-origin mutation requests', async () => {
    const rules = await config.headers!()
    const publicReads = rules.find(rule => rule.source.includes(':endpoint'))!
    expect(publicReads.headers).toContainEqual({ key: 'Access-Control-Allow-Origin', value: '*' })
    expect(publicReads.headers).toContainEqual({ key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' })
    expect(JSON.stringify(rules)).not.toContain('X-Admin-Request')
})
