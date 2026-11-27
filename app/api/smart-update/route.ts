import { requireRefreshAuthorization } from '@/lib/refresh-auth'
import { publishStagedRefresh } from '@/lib/refresh-service'
import { refreshFailure } from '@/lib/refresh-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const maxDuration = 300
const requestSchema = z.object({
    run_id: z.uuid().optional(),
    // Compatibility with old callers, but partial or direct-production updates cannot publish.
    levels: z.array(z.enum(['states', 'counties', 'zips'])).optional()
        .refine(value => value === undefined || new Set(value).size === 3, 'All aggregation levels are required'),
    useStaging: z.literal(true).optional()
}).strict()

async function update(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return NextResponse.json({ error: 'A complete staged refresh is required', details: parsed.error.issues.map(issue => issue.message) }, { status: 400 })
    try { return NextResponse.json(await publishStagedRefresh(parsed.data.run_id)) }
    catch (error) { return refreshFailure(error) }
}
export async function POST(request: NextRequest) {
    const denied = requireRefreshAuthorization(request)
    if (denied) return denied
    let input: unknown
    try { input = await request.json() }
    catch { return NextResponse.json({ error: 'A JSON request body is required' }, { status: 400 }) }
    return update(input)
}
export async function GET(request: NextRequest) {
    const denied = requireRefreshAuthorization(request)
    if (denied) return denied
    if (request.nextUrl.searchParams.has('level')) return NextResponse.json({ error: 'Partial refresh publication is not supported' }, { status: 400 })
    return update({ run_id: request.nextUrl.searchParams.get('run_id') ?? undefined })
}
