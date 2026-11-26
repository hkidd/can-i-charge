import { NextRequest, NextResponse } from 'next/server'
import { requireRefreshAuthorization } from '@/lib/refresh-auth'
import { stageStationRefresh, publishStagedRefresh } from '@/lib/refresh-service'
import { refreshFailure } from '@/lib/refresh-response'

export const maxDuration = 300
export async function GET(request: NextRequest) {
    const denied = requireRefreshAuthorization(request)
    if (denied) return denied
    const signal = AbortSignal.timeout(240000)
    try {
        // Direct calls avoid two nested HTTP requests and propagate the exact snapshot identity.
        const staged = await stageStationRefresh(signal)
        return NextResponse.json(await publishStagedRefresh(staged.run_id, signal))
    } catch (error) { return refreshFailure(error) }
}
