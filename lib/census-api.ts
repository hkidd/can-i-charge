import { supabaseAdmin } from './supabase'

const CENSUS_API_KEY = process.env.CENSUS_API_KEY
const CENSUS_BASE_URL = 'https://api.census.gov/data'
const FETCH_TIMEOUT = 5000 // 5 second timeout

// Helper function for fetch with timeout
async function fetchWithTimeout(
    url: string,
    timeout: number = FETCH_TIMEOUT
): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)
        return response
    } catch (error) {
        clearTimeout(timeoutId)
        throw error
    }
}

// Add a simple delay helper
function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchZipPopulation(zipCode: string): Promise<number> {
    if (!CENSUS_API_KEY) {
        console.warn('Census API key not found, using estimate')
        return Math.floor(Math.random() * 40000) + 5000
    }

    try {
        // Add small delay to avoid rate limiting
        await delay(50)

        // Use ACS 5-Year estimates for ZCTA
        const url = `https://api.census.gov/data/2022/acs/acs5?get=B01003_001E&for=zip%20code%20tabulation%20area:${zipCode}&key=${CENSUS_API_KEY}`

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CanICharge/1.0'
            }
        })

        if (!response.ok) {
            throw new Error(`Census API error: ${response.status}`)
        }

        const text = await response.text()

        // Check if response is empty or invalid
        if (!text || text.trim() === '') {
            throw new Error('Empty Census response')
        }

        const data = JSON.parse(text)

        if (data && data.length > 1) {
            const population = parseInt(data[1][0])
            if (!isNaN(population) && population > 0) {
                return population
            }
        }

        throw new Error('Invalid Census response')
    } catch (error) {
        // Silently fall back to estimate (expected for many zips)
        return Math.floor(Math.random() * 40000) + 5000
    }
}

// Fetch state population from Census API with caching
export async function fetchStatePopulation(stateCode: string): Promise<number> {
    // Check cache first
    const cached = await getPopulationFromCache('state', stateCode)
    if (cached !== null) {
        console.log(`Using cached population for state ${stateCode}: ${cached}`)
        return cached
    }

    // Try to fetch from Census API with timeout
    console.log(`Fetching population from Census API for state ${stateCode}`)

    try {
        const year = 2022
        const url = `${CENSUS_BASE_URL}/${year}/acs/acs5?get=B01003_001E,NAME&for=state:${getStateFIPSCode(
            stateCode
        )}&key=${CENSUS_API_KEY}`

        const response = await fetchWithTimeout(url, FETCH_TIMEOUT)

        if (!response.ok) {
            throw new Error(`Census API returned ${response.status}`)
        }

        const data = await response.json()

        if (data.length > 1) {
            const population = parseInt(data[1][0])
            const stateName = data[1][1]

            await savePopulationToCache(
                'state',
                stateCode,
                stateName,
                population
            )

            console.log(`✓ Fetched and cached ${stateCode}: ${population}`)
            return population
        }

        throw new Error('No data returned from Census API')
    } catch (error) {
        console.warn(
            `Census API failed for ${stateCode}, using estimate:`,
            error instanceof Error ? error.message : 'Unknown error'
        )
        return getStatePopulationEstimate(stateCode)
    }
}

// Fetch county population with caching
export async function fetchCountyPopulation(
    stateFIPS: string,
    countyFIPS: string
): Promise<number> {
    const cacheKey = `${stateFIPS}-${countyFIPS}`

    const cached = await getPopulationFromCache('county', cacheKey)
    if (cached !== null) {
        return cached
    }

    try {
        const year = 2022
        const url = `${CENSUS_BASE_URL}/${year}/acs/acs5?get=B01003_001E,NAME&for=county:${countyFIPS}&in=state:${stateFIPS}&key=${CENSUS_API_KEY}`

        const response = await fetchWithTimeout(url, FETCH_TIMEOUT)

        if (!response.ok) {
            throw new Error(`Census API returned ${response.status}`)
        }

        const data = await response.json()

        if (data.length > 1) {
            const population = parseInt(data[1][0])
            const countyName = data[1][1]

            await savePopulationToCache(
                'county',
                cacheKey,
                countyName,
                population
            )

            return population
        }

        throw new Error('No data returned')
    } catch (error) {
        console.warn(`Census API failed for county, using estimate`)
        return estimateCountyPopulation()
    }
}

// Batch function for ZIP populations
export async function fetchZipPopulationBatch(zipCodes: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>()
    
    if (!CENSUS_API_KEY) {
        console.warn('Census API key not found, using estimates for batch')
        zipCodes.forEach(zip => {
            results.set(zip, Math.floor(Math.random() * 40000) + 5000)
        })
        return results
    }

    // Process in smaller chunks to avoid URL length limits
    const chunkSize = 50
    
    for (let i = 0; i < zipCodes.length; i += chunkSize) {
        const chunk = zipCodes.slice(i, i + chunkSize)
        
        try {
            // Add delay between chunks to avoid rate limiting
            if (i > 0) await delay(100)
            
            // Build URL for multiple ZIP codes
            const zipQuery = chunk.join(',')
            const url = `https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,zip%20code%20tabulation%20area&for=zip%20code%20tabulation%20area:${zipQuery}&key=${CENSUS_API_KEY}`
            
            console.log(`Fetching population for ${chunk.length} ZIP codes...`)
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'CanICharge/1.0'
                }
            })

            if (!response.ok) {
                throw new Error(`Census API error: ${response.status}`)
            }

            const text = await response.text()
            if (!text || text.trim() === '') {
                throw new Error('Empty Census response')
            }

            const data = JSON.parse(text)
            
            if (data && Array.isArray(data) && data.length > 0) {
                // Skip header row and process data rows
                for (let j = 1; j < data.length; j++) {
                    const row = data[j]
                    if (row && row.length >= 2) {
                        const population = parseInt(row[0])
                        const zipCode = row[1]
                        
                        if (!isNaN(population) && population > 0 && zipCode) {
                            results.set(zipCode, population)
                        }
                    }
                }
            }
            
            console.log(`✓ Fetched ${results.size} valid populations from ${chunk.length} ZIP codes`)
            
        } catch (error) {
            console.warn(`Census batch API failed for chunk, using estimates:`, error instanceof Error ? error.message : 'Unknown error')
            // Fall back to estimates for this chunk
            chunk.forEach(zip => {
                if (!results.has(zip)) {
                    results.set(zip, Math.floor(Math.random() * 40000) + 5000)
                }
            })
        }
    }
    
    // Ensure all requested ZIP codes have values (fill missing with estimates)
    zipCodes.forEach(zip => {
        if (!results.has(zip)) {
            results.set(zip, estimateZipPopulation())
        }
    })
    
    return results
}

// Estimate functions (used as fallbacks)
export function estimateCountyPopulation(): number {
    return 50000
}

export function estimateZipPopulation(): number {
    return 15000
}

export function estimateNeighborhoodPopulation(): number {
    return 2500
}

// Cache management
async function getPopulationFromCache(
    regionType: string,
    regionCode: string
): Promise<number | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('population_cache')
            .select('population, fetched_at')
            .eq('region_type', regionType)
            .eq('region_code', regionCode)
            .single()

        if (error || !data) {
            return null
        }

        const cacheAge = Date.now() - new Date(data.fetched_at).getTime()
        const thirtyDays = 30 * 24 * 60 * 60 * 1000

        if (cacheAge > thirtyDays) {
            console.log(`Cache expired for ${regionType} ${regionCode}`)
            return null
        }

        return data.population
    } catch (error) {
        console.warn('Cache lookup failed:', error)
        return null
    }
}

async function savePopulationToCache(
    regionType: string,
    regionCode: string,
    regionName: string,
    population: number
): Promise<void> {
    try {
        await supabaseAdmin.from('population_cache').upsert(
            {
                region_type: regionType,
                region_code: regionCode,
                region_name: regionName,
                population: population,
                updated_at: new Date().toISOString()
            },
            {
                onConflict: 'region_type,region_code'
            }
        )
    } catch (error) {
        console.warn('Failed to save to cache:', error)
    }
}

// State FIPS codes mapping
function getStateFIPSCode(stateCode: string): string {
    const fips: Record<string, string> = {
        AL: '01',
        AK: '02',
        AZ: '04',
        AR: '05',
        CA: '06',
        CO: '08',
        CT: '09',
        DE: '10',
        FL: '12',
        GA: '13',
        HI: '15',
        ID: '16',
        IL: '17',
        IN: '18',
        IA: '19',
        KS: '20',
        KY: '21',
        LA: '22',
        ME: '23',
        MD: '24',
        MA: '25',
        MI: '26',
        MN: '27',
        MS: '28',
        MO: '29',
        MT: '30',
        NE: '31',
        NV: '32',
        NH: '33',
        NJ: '34',
        NM: '35',
        NY: '36',
        NC: '37',
        ND: '38',
        OH: '39',
        OK: '40',
        OR: '41',
        PA: '42',
        RI: '44',
        SC: '45',
        SD: '46',
        TN: '47',
        TX: '48',
        UT: '49',
        VT: '50',
        VA: '51',
        WA: '53',
        WV: '54',
        WI: '55',
        WY: '56'
    }

    return fips[stateCode.toUpperCase()] || '00'
}

// State population estimates (fallbacks)
function getStatePopulationEstimate(stateCode: string): number {
    const estimates: Record<string, number> = {
        AL: 5024279,
        AK: 733391,
        AZ: 7151502,
        AR: 3011524,
        CA: 39538223,
        CO: 5773714,
        CT: 3605944,
        DE: 989948,
        FL: 21538187,
        GA: 10711908,
        HI: 1455271,
        ID: 1839106,
        IL: 12812508,
        IN: 6785528,
        IA: 3190369,
        KS: 2937880,
        KY: 4505836,
        LA: 4657757,
        ME: 1362359,
        MD: 6177224,
        MA: 7029917,
        MI: 10077331,
        MN: 5706494,
        MS: 2961279,
        MO: 6154913,
        MT: 1084225,
        NE: 1961504,
        NV: 3104614,
        NH: 1377529,
        NJ: 9288994,
        NM: 2117522,
        NY: 20201249,
        NC: 10439388,
        ND: 779094,
        OH: 11799448,
        OK: 3959353,
        OR: 4237256,
        PA: 13002700,
        RI: 1097379,
        SC: 5118425,
        SD: 886667,
        TN: 6910840,
        TX: 29145505,
        UT: 3271616,
        VT: 643077,
        VA: 8631393,
        WA: 7705281,
        WV: 1793716,
        WI: 5893718,
        WY: 576851
    }

    return estimates[stateCode.toUpperCase()] || 1000000
}
