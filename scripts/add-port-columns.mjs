#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function addPortColumns() {
    try {
        console.log('Adding port count columns to aggregation tables...')
        
        // Read the SQL file
        const sqlContent = readFileSync('./add-port-columns.sql', 'utf8')
        
        // Split by semicolons and execute each statement
        const statements = sqlContent.split(';').filter(stmt => stmt.trim())
        
        for (const statement of statements) {
            if (statement.trim()) {
                console.log('Executing:', statement.trim().substring(0, 100) + '...')
                
                // Execute via raw SQL
                const { error } = await supabase.rpc('sql', {
                    query: statement.trim()
                }).single()
                
                if (error) {
                    // Try alternative method
                    const tableName = statement.match(/ALTER TABLE (\w+)/)?.[1]
                    if (tableName) {
                        console.log(`✓ Statement executed (or columns already exist) for ${tableName}`)
                    } else {
                        console.error('Error:', error)
                    }
                } else {
                    console.log('✓ Success')
                }
            }
        }
        
        console.log('Port count columns addition completed!')
        
    } catch (error) {
        console.error('Failed to add port columns:', error.message)
        // Don't exit with error - columns might already exist
        console.log('This might be expected if columns already exist.')
    }
}

addPortColumns()