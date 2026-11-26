import { Checkout } from '@polar-sh/nextjs'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const accessToken = process.env.POLAR_ACCESS_TOKEN
    const publicUrl = process.env.NEXT_PUBLIC_URL
    const productId = process.env.POLAR_PRODUCT_ID
    const environment = process.env.POLAR_ENVIRONMENT || 'production'
    if (!accessToken?.trim() || !publicUrl || !productId?.trim() ||
        !['production', 'sandbox'].includes(environment)) {
        return NextResponse.json({ error: 'Checkout service is not configured' }, { status: 503 })
    }
    const checkout = Checkout({
        accessToken,
        environment: environment as 'production' | 'sandbox',
        successUrl: new URL('/checkout/success', publicUrl).toString()
    })
    const url = request.nextUrl.clone()
    url.search = ''
    url.searchParams.set('products', productId)
    return checkout(new NextRequest(url, { headers: request.headers }))
}
