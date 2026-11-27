import { afterEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const services = vi.hoisted(() => ({ checkout: vi.fn(), resend: vi.fn() }))
vi.mock('@polar-sh/nextjs', () => ({ Checkout: services.checkout }))
vi.mock('resend', () => ({ Resend: services.resend }))
import { GET } from '@/app/api/checkout/route'
import { sendApiKeyEmail } from '@/lib/email'

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.clearAllMocks() })

it('keeps checkout unavailable until its server configuration is present', async () => {
    vi.stubEnv('POLAR_ACCESS_TOKEN', undefined)
    vi.stubEnv('NEXT_PUBLIC_URL', 'https://fixture.invalid')
    expect((await GET(new NextRequest('https://fixture.invalid/api/checkout'))).status).toBe(503)
    expect(services.checkout).not.toHaveBeenCalled()
})

it('constructs checkout using a normalized success URL', async () => {
    vi.stubEnv('POLAR_ACCESS_TOKEN', 'fixture-token')
    vi.stubEnv('POLAR_PRODUCT_ID', 'fixture-product')
    vi.stubEnv('POLAR_ENVIRONMENT', 'sandbox')
    vi.stubEnv('NEXT_PUBLIC_URL', 'https://fixture.invalid/')
    const handler = vi.fn(async (request: NextRequest) => {
        expect(request.nextUrl.searchParams.getAll('products')).toEqual(['fixture-product'])
        return new Response(null, { status: 200 })
    })
    services.checkout.mockReturnValue(handler)
    expect((await GET(new NextRequest('https://fixture.invalid/api/checkout?products=other-product&customer_id=other-customer'))).status).toBe(200)
    expect(services.checkout).toHaveBeenCalledWith({ accessToken: 'fixture-token', environment: 'sandbox', successUrl: 'https://fixture.invalid/checkout/success' })
})

it('does not construct an email client at build time or without a configured key', async () => {
    vi.stubEnv('RESEND_API_KEY', undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await sendApiKeyEmail({ to: 'fixture@example.invalid', apiKey: 'fixture-key' })
    expect(result.success).toBe(false)
    expect(services.resend).not.toHaveBeenCalled()
})
