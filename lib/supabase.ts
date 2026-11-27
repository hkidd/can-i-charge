import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Regular client for public operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type-safe query helpers
export async function getChargingStations() {
    return await supabase.from('charging_stations').select('*')
}

export async function getStateData() {
    return await supabase.from('state_level_data').select('*')
}
