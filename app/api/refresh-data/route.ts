import { requireRefreshAuthorization } from '@/lib/refresh-auth'
import { stageStationRefresh } from '@/lib/refresh-service'
import { refreshFailure } from '@/lib/refresh-response'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

export async function POST(request: NextRequest) {
    const denied = requireRefreshAuthorization(request)
    if (denied) return denied
    try { return NextResponse.json(await stageStationRefresh()) }
    catch (error) { return refreshFailure(error) }
}
export async function GET(request: NextRequest) { return POST(request) }
