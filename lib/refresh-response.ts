import { captureException } from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { RefreshError } from './refresh-store'

export function refreshFailure(error: unknown) {
    const status = error instanceof RefreshError ? error.status : 500
    if (status >= 500) captureException(error, { tags: { component: 'station-refresh' } })
    console.error('Station refresh failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ success: false, error: error instanceof RefreshError ? error.message : 'Station refresh failed; production was not replaced by an incomplete snapshot' }, { status })
}
