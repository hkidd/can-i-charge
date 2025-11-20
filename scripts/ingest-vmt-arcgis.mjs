#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables from .env.local (Next.js convention)
config({ path: '.env.local' })

console.log('🔑 Environment check:')
console.log('   Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Found' : '❌ Missing')
console.log('   Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Found' : '❌ Missing')

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:')
    console.error('   NEXT_PUBLIC_SUPABASE_URL')
    console.error('   SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BASE_URL = 'https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/County_VMT_2022/FeatureServer/0/query'

async function fetchVMTBatch(offset = 0, limit = 2000) {
    const params = new URLSearchParams({
        where: '1=1',                    // Select all rows
        outFields: 'FIPS,VMT_2022,NAMELSAD,State',  // Correct field names
        f: 'json',                      // JSON format
        resultOffset: offset.toString(),
        resultRecordCount: limit.toString()
    })
    
    const url = `${BASE_URL}?${params}`
    console.log(`📡 Fetching batch: offset=${offset}, limit=${limit}`)
    
    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (data.error) {
            throw new Error(`ArcGIS API Error: ${data.error.message}`)
        }
        
        return {
            features: data.features || [],
            hasMore: data.features && data.features.length === limit
        }
    } catch (error) {
        console.error(`❌ Error fetching batch at offset ${offset}:`, error)
        throw error
    }
}

async function getAllVMTData() {
    const allFeatures = []
    let offset = 0
    const batchSize = 2000
    
    console.log('🌍 Fetching all VMT data from ArcGIS...')
    
    while (true) {
        const { features, hasMore } = await fetchVMTBatch(offset, batchSize)
        
        if (features.length === 0) {
            console.log('📄 No more data to fetch')
            break
        }
        
        allFeatures.push(...features)
        console.log(`   Retrieved ${features.length} records (total: ${allFeatures.length})`)
        
        if (!hasMore) {
            console.log('📄 Reached end of data')
            break
        }
        
        offset += batchSize
        
        // Be nice to the API - small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log(`✅ Total VMT records fetched: ${allFeatures.length}`)
    return allFeatures
}

async function updateCountyVMTData() {
    try {
        console.log('🚗 Starting VMT data ingestion from ArcGIS...')
        
        // Fetch all VMT data from ArcGIS
        const vmtFeatures = await getAllVMTData()
        
        if (vmtFeatures.length === 0) {
            console.error('❌ No VMT data retrieved from ArcGIS')
            return
        }
        
        console.log('🔍 Sample VMT record:', vmtFeatures[0])
        
        // Get existing county data to calculate VMT per capita
        console.log('📊 Fetching existing county data for population...')
        const { data: counties, error: fetchError } = await supabase
            .from('county_level_data')
            .select('id, county_name, state, population')
        
        if (fetchError) {
            console.error('❌ Error fetching county data:', fetchError)
            return
        }
        
        console.log(`📋 Found ${counties.length} existing counties`)
        
        // Create a FIPS lookup for existing counties
        const countyByFIPS = new Map()
        counties.forEach(county => {
            // Extract FIPS from county data (might need to construct it)
            // This depends on how your county data stores FIPS codes
            countyByFIPS.set(`${county.state}-${county.county_name}`, county)
        })
        
        // Process VMT data and update counties
        let updated = 0
        let skipped = 0
        const batchSize = 50
        
        console.log('🔍 Processing VMT features and matching to counties...')
        
        for (let i = 0; i < vmtFeatures.length; i += batchSize) {
            const batch = vmtFeatures.slice(i, i + batchSize)
            const updates = []
            
            for (const feature of batch) {
                const fipsCode = feature.attributes.FIPS
                const dailyVMT = feature.attributes.VMT_2022 || feature.attributes.VMT_2021
                const countyName = feature.attributes.NAMELSAD
                const stateName = feature.attributes.State
                
                if (!fipsCode || !dailyVMT || isNaN(parseFloat(dailyVMT))) {
                    skipped++
                    continue
                }
                
                // Find county by FIPS code
                const countyRecord = await findCountyByFIPS(fipsCode, countyName, stateName)
                
                if (countyRecord && countyRecord.population) {
                    const dailyVMTNum = parseFloat(dailyVMT)
                    const vmtPerCapita = dailyVMTNum / countyRecord.population
                    
                    updates.push({
                        id: countyRecord.id,
                        daily_vmt: dailyVMTNum,
                        vmt_per_capita: vmtPerCapita,
                        county_name: countyName,
                        state: stateName
                    })
                } else {
                    if (fipsCode) {
                        console.warn(`⚠️  No match for FIPS ${fipsCode}: ${countyName}, ${stateName}`)
                    }
                    skipped++
                }
            }
            
            // Batch update counties - use individual updates to avoid constraint issues
            if (updates.length > 0) {
                let batchUpdated = 0
                for (const update of updates) {
                    try {
                        const { error } = await supabase
                            .from('county_level_data')
                            .update({
                                daily_vmt: update.daily_vmt,
                                vmt_per_capita: update.vmt_per_capita
                            })
                            .eq('id', update.id)
                        
                        if (error) {
                            console.error(`❌ Error updating ${update.county_name}, ${update.state}:`, error)
                        } else {
                            batchUpdated++
                        }
                    } catch (updateError) {
                        console.error(`❌ Update failed for ${update.county_name}:`, updateError)
                    }
                }
                
                updated += batchUpdated
                console.log(`✅ Updated batch ${Math.floor(i / batchSize) + 1}: ${batchUpdated}/${updates.length} counties`)
            }
        }
        
        console.log(`\n📊 Final Summary:`)
        console.log(`   VMT records processed: ${vmtFeatures.length}`)
        console.log(`   Counties updated: ${updated}`)
        console.log(`   Records skipped: ${skipped}`)
        
    } catch (error) {
        console.error('💥 Fatal error:', error)
    }
}

// FIPS state code to abbreviation mapping
const FIPS_TO_STATE = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
    '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS',
    '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
    '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY',
    '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC',
    '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
    '55': 'WI', '56': 'WY', '72': 'PR', '11': 'DC'
}

async function findCountyByFIPS(fipsCode, countyName, stateName) {
    if (!fipsCode || fipsCode.length !== 5) {
        return null
    }
    
    // FIPS codes are 5 digits: 2 for state + 3 for county
    const stateFIPS = fipsCode.substring(0, 2)
    const stateAbbr = FIPS_TO_STATE[stateFIPS]
    
    if (!stateAbbr) {
        console.warn(`⚠️  Unknown state FIPS: ${stateFIPS} in ${fipsCode}`)
        return null
    }
    
    // Clean county name by removing common suffixes like 'County', 'Parish', etc.
    const cleanCountyName = countyName
        ?.replace(/\s+(County|Parish|Borough|Census Area|Municipality|City and Borough|Municipio)$/i, '')
        ?.trim()
        ?.toLowerCase()
    
    if (!cleanCountyName) {
        return null
    }
    
    // Query counties for the state and try to match by name
    const { data, error } = await supabase
        .from('county_level_data')
        .select('*')
        .eq('state', stateAbbr)
    
    if (error) {
        console.error(`❌ Error querying counties for state ${stateAbbr}:`, error)
        return null
    }
    
    if (!data || data.length === 0) {
        console.warn(`⚠️  No counties found for state ${stateAbbr}`)
        return null
    }
    
    // Try to find exact county name match
    const exactMatch = data.find(county => {
        const dbCountyName = county.county_name?.toLowerCase()?.trim()
        return dbCountyName === cleanCountyName
    })
    
    if (exactMatch) {
        return exactMatch
    }
    
    // Try partial match for cases like "DeKalb" vs "De Kalb"
    const partialMatch = data.find(county => {
        const dbCountyName = county.county_name?.toLowerCase()?.trim()
        return dbCountyName && cleanCountyName && (
            dbCountyName.includes(cleanCountyName) || 
            cleanCountyName.includes(dbCountyName) ||
            dbCountyName.replace(/\s+/g, '') === cleanCountyName.replace(/\s+/g, '')
        )
    })
    
    if (partialMatch) {
        return partialMatch
    }
    
    // If no match found, log it for debugging
    console.warn(`⚠️  No county match for "${cleanCountyName}" in ${stateAbbr} (FIPS: ${fipsCode})`)
    console.warn(`     Available counties: ${data.map(c => c.county_name).slice(0, 3).join(', ')}...`)
    
    return null
}

// Alternative approach: get county details from ArcGIS with county names
async function fetchVMTWithCountyNames() {
    const params = new URLSearchParams({
        where: '1=1',
        outFields: '*',  // Get all fields to see what's available
        f: 'json',
        resultRecordCount: '5'       // Just get a sample to see the data structure
    })
    
    const url = `${BASE_URL}?${params}`
    console.log('📡 Testing URL:', url)
    
    try {
        const response = await fetch(url)
        console.log('📡 Response status:', response.status, response.statusText)
        
        const data = await response.json()
        console.log('📄 Full response:', JSON.stringify(data, null, 2))
        
        if (data.error) {
            console.error('❌ ArcGIS API Error:', data.error)
            return []
        }
        
        if (data.features && data.features.length > 0) {
            console.log('🔍 Sample ArcGIS record:')
            console.log(JSON.stringify(data.features[0], null, 2))
            console.log(`📊 Total features in response: ${data.features.length}`)
        } else {
            console.log('⚠️  No features returned')
        }
        
        return data.features || []
    } catch (error) {
        console.error('❌ Error fetching sample data:', error)
        console.error('   Error details:', error.message)
        return []
    }
}


// Main execution
async function main() {
    console.log('🧪 First, let\'s explore the ArcGIS data structure...')
    const sampleData = await fetchVMTWithCountyNames()
    
    if (sampleData.length > 0) {
        console.log('\n🚗 Proceeding with full VMT data ingestion...')
        console.log('   This will update your county_level_data table with VMT information.')
        
        await updateCountyVMTData()
    } else {
        console.log('❌ Unable to fetch sample data, aborting ingestion')
    }
}

main().catch(error => {
    console.error('💥 Script failed:', error)
    process.exit(1)
})