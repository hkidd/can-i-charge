import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('state_level_data')
            .select('state_name, ev_infrastructure_score')
            .order('ev_infrastructure_score', { ascending: false })
            .limit(10)

        if (error) {
            console.error('Error fetching state data:', error)
            return NextResponse.json({ error: 'Failed to fetch state data' }, { status: 500 })
        }

        // Format for the bar chart
        const rankings = data?.map((state, index) => ({
            rank: index + 1,
            state: state.state_name,
            score: state.ev_infrastructure_score || 0,
        })) || []

        return NextResponse.json(rankings)
    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
