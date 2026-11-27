import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

/** Every refresh entry point must use the same server-side authorization. */
export function requireRefreshAuthorization(request: Request): NextResponse | null {
    const secret = process.env.CRON_SECRET
    if (!secret?.trim()) {
        return NextResponse.json(
            { error: 'Refresh service is not configured' },
            { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
        )
    }

    const provided = Buffer.from(request.headers.get('authorization') || '')
    const expected = Buffer.from(`Bearer ${secret}`)
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401, headers: { 'Cache-Control': 'private, no-store' } }
        )
    }
    return null
}
