import { expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const database = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: database.get }))
vi.mock('@/lib/error-handling', () => ({ logError: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
    rateLimit: () => ({ success: true }), getClientId: () => 'fixture'
}))
import { GET } from '@/app/api/ev-score/route'

it.each([
    'lat=39junk&lng=-105',
    'lat=NaN&lng=-105',
    'lat=Infinity&lng=-105',
    'lat=39&lng=',
    'lat=&lng=-105',
    'lat=39',
    'lng=-105',
    'lat=91&lng=-105&address=Denver',
    'lat=39&lng=-181'
])('rejects malformed coordinates before any database call: %s', async query => {
    database.get.mockClear()
    const response = await GET(new NextRequest(`https://fixture.invalid/api/ev-score?${query}`))
    expect(response.status).toBe(400)
    expect(database.get).not.toHaveBeenCalled()
})
