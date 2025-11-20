#!/usr/bin/env node

import XLSX from 'xlsx'
const { readFile, utils } = XLSX
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

async function ingestVMTData() {
    try {
        console.log('🚗 Starting VMT data ingestion...')
        
        // Read the Excel file
        const filePath = path.join(__dirname, '..', 'vm2.xlsx')
        const workbook = readFile(filePath)
        
        console.log('📊 Available worksheets:', workbook.SheetNames)
        
        // Usually VM-2 data is in the first sheet or a sheet named 'VM-2'
        const sheetName = workbook.SheetNames.find(name => 
            name.toLowerCase().includes('vm') || 
            name.toLowerCase().includes('county') ||
            workbook.SheetNames.indexOf(name) === 0
        ) || workbook.SheetNames[0]
        
        console.log(`📋 Processing sheet: ${sheetName}`)
        
        const worksheet = workbook.Sheets[sheetName]
        const data = utils.sheet_to_json(worksheet)
        
        console.log(`📈 Found ${data.length} rows of data`)
        console.log('🔍 Sample row:', data[0])
        
        // Clear staging table
        console.log('🧹 Clearing staging table...')
        const { error: clearError } = await supabase
            .from('county_traffic_stats_staging')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000')
        
        if (clearError) {
            console.error('❌ Error clearing staging table:', clearError)
            return
        }
        
        // Process and insert data in batches
        const batchSize = 100
        let processed = 0
        let inserted = 0
        
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize)
            const processedBatch = []
            
            for (const row of batch) {
                const processedRow = processRow(row)
                if (processedRow) {
                    processedBatch.push(processedRow)
                }
                processed++
            }
            
            if (processedBatch.length > 0) {
                const { error } = await supabase
                    .from('county_traffic_stats_staging')
                    .insert(processedBatch)
                
                if (error) {
                    console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error)
                    console.error('Sample problematic row:', processedBatch[0])
                } else {
                    inserted += processedBatch.length
                    console.log(`✅ Inserted batch ${i / batchSize + 1}: ${processedBatch.length} records`)
                }
            }
        }
        
        console.log(`\n📊 Summary:`)
        console.log(`   Processed: ${processed} rows`)
        console.log(`   Inserted: ${inserted} records`)
        
        // Swap staging to production
        if (inserted > 0) {
            console.log('\n🔄 Swapping staging to production...')
            const { error: swapError } = await supabase.rpc('swap_traffic_tables')
            
            if (swapError) {
                console.error('❌ Error swapping tables:', swapError)
            } else {
                console.log('✅ Successfully swapped staging to production!')
            }
        }
        
    } catch (error) {
        console.error('💥 Fatal error:', error)
    }
}

function processRow(row) {
    // VM-2 files can have different column structures
    // Common patterns include:
    // - State, County, FIPS, Annual VMT, etc.
    // - Or state-level data that needs county allocation
    
    // Let's examine the keys to understand the structure
    const keys = Object.keys(row).map(k => k.toLowerCase())
    
    // Look for common column patterns
    const stateName = findColumnValue(row, ['state', 'state_name', 'st'])
    const countyName = findColumnValue(row, ['county', 'county_name', 'cnty'])
    const fipsCode = findColumnValue(row, ['fips', 'fips_code', 'geoid', 'id'])
    const annualVMT = findColumnValue(row, ['vmt', 'annual_vmt', 'vehicle_miles', 'miles'])
    const population = findColumnValue(row, ['population', 'pop'])
    
    // Skip if missing essential data
    if (!stateName && !countyName && !fipsCode) {
        return null
    }
    
    if (!annualVMT || isNaN(parseFloat(annualVMT))) {
        return null
    }
    
    const annualVMTNum = parseFloat(annualVMT)
    const dailyVMT = annualVMTNum / 365
    
    // Calculate VMT per capita if we have population
    let vmtPerCapita = null
    if (population && !isNaN(parseFloat(population))) {
        vmtPerCapita = dailyVMT / parseFloat(population)
    }
    
    // Extract state code from state name if needed
    const stateCode = getStateCode(stateName) || stateName
    
    return {
        fips_code: fipsCode || `${stateCode}-${countyName}`,
        county_name: countyName || 'Unknown',
        state_code: stateCode,
        daily_vmt: dailyVMT,
        vmt_per_capita: vmtPerCapita,
        annual_vmt: annualVMTNum,
        data_year: 2022 // Adjust based on your file's year
    }
}

function findColumnValue(row, possibleKeys) {
    for (const key of possibleKeys) {
        for (const rowKey of Object.keys(row)) {
            if (rowKey.toLowerCase().includes(key)) {
                return row[rowKey]
            }
        }
    }
    return null
}

function getStateCode(stateName) {
    const stateMap = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
        'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
        'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
        'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
        'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
        'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
        'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
        'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
        'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
        'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
        'wisconsin': 'WI', 'wyoming': 'WY'
    }
    
    if (!stateName) return null
    return stateMap[stateName.toLowerCase()]
}

// Run the ingestion
ingestVMTData()