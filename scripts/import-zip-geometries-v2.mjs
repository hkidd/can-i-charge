import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function importZipGeometries() {
    console.log('🗺️  ZIP Geometries Import - Dedicated Table Version')
    console.log('Reading GeoJSON file...')
    const geojson = JSON.parse(fs.readFileSync('./zips.geojson', 'utf8'))

    console.log(`Processing ${geojson.features.length} ZIP boundaries...`)

    // Clear existing geometries (optional - comment out if you want to preserve existing)
    console.log('Clearing existing geometries...')
    await supabase
        .from('zip_geometries')
        .delete()
        .neq('zip_code', '00000')

    let inserted = 0
    let skipped = 0
    let errors = 0
    const batchSize = 500
    const batch = []

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
        
        // Skip invalid ZIP codes
        if (zipCode.length !== 5 || isNaN(Number(zipCode))) {
            skipped++
            continue
        }

        // Get state from properties or derive from first station in that ZIP later
        const state = feature.properties.STATE || 
                     feature.properties.STATEFP || 
                     null

        // Convert geometry to PostGIS format
        const geometryJson = JSON.stringify(feature.geometry)

        batch.push({
            zip_code: zipCode,
            geometry: geometryJson,
            state: state
        })

        // Insert in batches
        if (batch.length >= batchSize) {
            try {
                console.log(`Inserting batch of ${batch.length} geometries...`)
                
                // Use raw SQL for geometry insertion
                for (const item of batch) {
                    const { error } = await supabase.rpc('insert_zip_geometry', {
                        p_zip_code: item.zip_code,
                        p_geometry_json: item.geometry,
                        p_state: item.state
                    })
                    
                    if (error) {
                        console.error(`Error inserting ${item.zip_code}:`, error)
                        errors++
                    } else {
                        inserted++
                    }
                }
                
                console.log(`✅ Inserted ${inserted} geometries so far...`)
                batch.length = 0
            } catch (err) {
                console.error('Batch insert error:', err)
                errors += batch.length
                batch.length = 0
            }
        }
    }

    // Insert remaining batch
    if (batch.length > 0) {
        console.log(`Inserting final batch of ${batch.length} geometries...`)
        for (const item of batch) {
            try {
                const { error } = await supabase.rpc('insert_zip_geometry', {
                    p_zip_code: item.zip_code,
                    p_geometry_json: item.geometry,
                    p_state: item.state
                })
                
                if (error) {
                    console.error(`Error inserting ${item.zip_code}:`, error)
                    errors++
                } else {
                    inserted++
                }
            } catch (err) {
                console.error(`Error with ZIP ${item.zip_code}:`, err)
                errors++
            }
        }
    }

    console.log(`\n✓ Import Complete:`)
    console.log(`  - ${inserted} ZIP geometries imported`)
    console.log(`  - ${errors} errors`)
    console.log(`  - ${skipped} features skipped (no valid ZIP code)`)

    // Verify
    const { count } = await supabase
        .from('zip_geometries')
        .select('*', { count: 'exact', head: true })

    console.log(`\n✓ Verified: ${count} ZIP geometries in database`)
    
    // Update state information from zip_level_data if needed
    console.log('\nUpdating state information from zip_level_data...')
    const { error: updateError } = await supabase.rpc('update_zip_geometry_states')
    
    if (updateError) {
        console.log('Could not update states (function may not exist yet)')
    } else {
        console.log('✓ State information updated')
    }
}

importZipGeometries().catch(console.error)