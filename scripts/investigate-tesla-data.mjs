#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function investigateTeslaData() {
    console.log('🔍 Investigating Tesla data in California...\n')
    
    // Get all CA stations with TESLA connector type
    const { data: teslaStations, error } = await supabase
        .from('charging_stations')
        .select('id, name, ev_connector_types, network, charger_type_detailed, num_ports, latitude, longitude')
        .eq('state', 'CA')
        .contains('ev_connector_types', ['TESLA'])
        .limit(20)
    
    if (error) {
        console.error('Error fetching Tesla stations:', error)
        return
    }
    
    console.log(`Found ${teslaStations?.length} Tesla stations (showing first 20):`)
    console.log('=====================================\n')
    
    teslaStations?.forEach((station, index) => {
        console.log(`${index + 1}. ${station.name}`)
        console.log(`   Network: ${station.network}`)
        console.log(`   Connector Types: ${JSON.stringify(station.ev_connector_types)}`)
        console.log(`   Charger Type: ${station.charger_type_detailed}`)
        console.log(`   Num Ports: ${station.num_ports}`)
        console.log(`   Location: ${station.latitude}, ${station.longitude}`)
        console.log('')
    })
    
    // Get total count by network
    const { data: networkCounts, error: networkError } = await supabase
        .from('charging_stations')
        .select('network')
        .eq('state', 'CA')
        .contains('ev_connector_types', ['TESLA'])
    
    if (!networkError && networkCounts) {
        const networkGroups = networkCounts.reduce((acc, station) => {
            const network = station.network || 'Unknown'
            acc[network] = (acc[network] || 0) + 1
            return acc
        }, {})
        
        console.log('Tesla stations by network:')
        Object.entries(networkGroups)
            .sort(([,a], [,b]) => b - a)
            .forEach(([network, count]) => {
                console.log(`   ${network}: ${count} stations`)
            })
        console.log('')
    }
    
    // Get total count by charger type
    const { data: typeCounts, error: typeError } = await supabase
        .from('charging_stations')
        .select('charger_type_detailed')
        .eq('state', 'CA')
        .contains('ev_connector_types', ['TESLA'])
    
    if (!typeError && typeCounts) {
        const typeGroups = typeCounts.reduce((acc, station) => {
            const type = station.charger_type_detailed || 'Unknown'
            acc[type] = (acc[type] || 0) + 1
            return acc
        }, {})
        
        console.log('Tesla stations by charger type:')
        Object.entries(typeGroups).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} stations`)
        })
        console.log('')
    }
    
    // Get total Tesla station count for CA
    const { count: totalTeslaCount } = await supabase
        .from('charging_stations')
        .select('id', { count: 'exact' })
        .eq('state', 'CA')
        .contains('ev_connector_types', ['TESLA'])
    
    console.log(`📊 Total Tesla stations in CA: ${totalTeslaCount}`)
    
    // Compare with actual Tesla Supercharger count
    const actualSuperchargers = 603
    console.log(`📊 Actual Tesla Superchargers (Oct 2025): ${actualSuperchargers}`)
    console.log(`📊 Difference: +${totalTeslaCount - actualSuperchargers} (${((totalTeslaCount / actualSuperchargers - 1) * 100).toFixed(1)}% more)`)
    
    if (totalTeslaCount > actualSuperchargers) {
        console.log('\n🤔 Possible explanations for the difference:')
        console.log('   • NREL includes Tesla destination chargers (Level 2)')
        console.log('   • NREL includes non-Tesla stations with NACS connectors')
        console.log('   • NREL data includes planned/under-construction stations')
        console.log('   • We are counting individual ports instead of stations')
    }
}

investigateTeslaData().catch(console.error)