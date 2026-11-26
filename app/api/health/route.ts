import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const MAX_DATA_AGE_MS = 36 * 60 * 60 * 1000
export async function GET() {
    const start = Date.now()
    try {
        const database = getSupabaseAdmin()
        const [stations, refresh] = await Promise.all([
            database.from('charging_stations').select('id').limit(1),
            database.from('station_refresh_runs').select('completed_at,station_count')
                .eq('status', 'published').order('completed_at', { ascending: false }).limit(1).maybeSingle()
        ])
        if (stations.error) return NextResponse.json({ status: 'unhealthy', message: 'Database connection failed' }, { status: 503 })
        const completed = typeof refresh.data?.completed_at === 'string' ? Date.parse(refresh.data.completed_at) : NaN
        const age = start - completed
        const fresh = !refresh.error && stations.data?.length && Number.isFinite(age) && age >= -300000 && age <= MAX_DATA_AGE_MS
        return NextResponse.json({
            status: fresh ? 'healthy' : 'degraded',
            message: fresh ? 'Station data is current' : 'Station refresh is missing or stale',
            checks: {
                database: 'connected', responseTime: `${Date.now() - start}ms`,
                refresh: { status: fresh ? 'fresh' : Number.isFinite(age) ? 'stale' : 'unknown',
                    last_published_at: Number.isFinite(completed) ? refresh.data?.completed_at ?? null : null,
                    station_count: refresh.data?.station_count ?? null }
            },
            timestamp: new Date().toISOString(), version: process.env.npm_package_version || '0.2.0'
        }, { status: fresh ? 200 : 503 })
    } catch {
        return NextResponse.json({ status: 'unhealthy', message: 'Health check failed' }, { status: 503 })
    }
}
