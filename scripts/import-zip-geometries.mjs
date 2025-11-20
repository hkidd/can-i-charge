import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function importZipGeometries() {
    console.log('Reading GeoJSON file...')
    const geojson = JSON.parse(fs.readFileSync('./zips.geojson', 'utf8'))

    console.log(`Processing ${geojson.features.length} ZIP boundaries...`)

    // Get ALL existing ZIPs from database (paginated)
    console.log('Fetching all existing ZIPs from database...')
    let allExistingZips = []
    let from = 0
    const batchSize = 1000

    while (true) {
        const { data: zips, error } = await supabase
            .from('zip_level_data')
            .select('zip_code')
            .range(from, from + batchSize - 1)

        if (error) {
            console.error('Error fetching ZIPs:', error)
            throw error
        }

        if (!zips || zips.length === 0) break

        allExistingZips = allExistingZips.concat(zips)
        console.log(`  Fetched ${allExistingZips.length} ZIPs...`)

        if (zips.length < batchSize) break
        from += batchSize
    }

    const existingZipSet = new Set(allExistingZips.map((z) => z.zip_code))
    console.log(`Found ${existingZipSet.size} total ZIPs in database`)

    let updated = 0
    let notFound = 0
    let skipped = 0

    for (const feature of geojson.features) {
        // Try multiple property names for ZIP code
        let zipCode =
            feature.properties.ZCTA5CE20 ||
            feature.properties.GEOID20 ||
            feature.properties.ZCTA5CE10 ||
            feature.properties.GEOID10 ||
            feature.properties.ZCTA

        if (!zipCode) {
            skipped++
            continue
        }

        // Clean ZIP code (remove any suffixes like -0000)
        zipCode = zipCode.split('-')[0].trim()

        // Check if this ZIP exists in our database
        if (!existingZipSet.has(zipCode)) {
            notFound++
            continue
        }

        // Convert geometry to JSON string
        const geometryJson = JSON.stringify(feature.geometry)

        try {
            // Update using the helper function
            const { error } = await supabase.rpc('update_zip_geometry', {
                p_zip_code: zipCode,
                p_geometry_json: geometryJson
            })

            if (error) {
                console.error(`Error updating ${zipCode}:`, error.message)
            } else {
                updated++
            }

            if (updated % 100 === 0) {
                console.log(
                    `Updated ${updated} ZIPs (${notFound} not in DB, ${skipped} skipped)...`
                )
            }
        } catch (err) {
            console.error(`Error with ZIP ${zipCode}:`, err.message)
        }
    }

    console.log(`\n✓ Complete:`)
    console.log(`  - ${updated} ZIPs updated with geometries`)
    console.log(`  - ${notFound} ZIPs not found in database`)
    console.log(`  - ${skipped} features skipped (no ZIP code)`)

    // Verify
    const { count } = await supabase
        .from('zip_level_data')
        .select('*', { count: 'exact', head: true })
        .not('geometry', 'is', null)

    console.log(`\n✓ Verified: ${count} ZIPs now have geometries in database`)
}

importZipGeometries().catch(console.error)
