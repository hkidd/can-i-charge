import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    const startTime = Date.now()
    
    try {
        // Test database connection
        const { data, error } = await supabaseAdmin
            .from('charging_stations')
            .select('id')
            .limit(1)
        
        if (error) {
            return NextResponse.json(
                {
                    status: 'unhealthy',
                    message: 'Database connection failed',
                    error: error.message,
                    timestamp: new Date().toISOString()
                },
                { status: 503 }
            )
        }
        
        const responseTime = Date.now() - startTime
        
        return NextResponse.json({
            status: 'healthy',
            message: 'All systems operational',
            checks: {
                database: 'connected',
                responseTime: `${responseTime}ms`
            },
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '0.1.0'
        })
        
    } catch (error) {
        return NextResponse.json(
            {
                status: 'unhealthy',
                message: 'Health check failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        )
    }
}