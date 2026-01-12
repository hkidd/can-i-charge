import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateResponse, EVScoreResponseSchema } from '@/lib/api-validation'
import { logError } from '@/lib/error-handling'
import { rateLimit, getClientId } from '@/lib/rate-limit'

// Convert score to letter grade
function getGrade(score: number): string {
    if (score >= 90) return 'A+'
    if (score >= 85) return 'A'
    if (score >= 80) return 'A-'
    if (score >= 75) return 'B+'
    if (score >= 70) return 'B'
    if (score >= 65) return 'B-'
    if (score >= 60) return 'C+'
    if (score >= 55) return 'C'
    if (score >= 50) return 'C-'
    if (score >= 45) return 'D+'
    if (score >= 40) return 'D'
    if (score >= 35) return 'D-'
    return 'F'
}

// Helper: Check if coordinates are in US
function isValidUSCoordinates(lat: number, lng: number): boolean {
    // Continental US + Alaska + Hawaii approximate bounds
    const isInContinental =
        lat >= 24.5 && lat <= 49.4 && lng >= -125 && lng <= -66.9
    const isInAlaska = lat >= 51 && lat <= 71.5 && lng >= -179 && lng <= -129
    const isInHawaii =
        lat >= 18.9 && lat <= 22.2 && lng >= -160 && lng <= -154.8

    return isInContinental || isInAlaska || isInHawaii
}

// Helper: Calculate distance between two points
function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 3959 // Earth radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// Helper: Get score message
function getScoreMessage(score: number, location: string): string {
    if (score >= 80) {
        return `Excellent! ${location} has outstanding EV charging infrastructure.`
    } else if (score >= 60) {
        return `Good news! ${location} has solid EV charging options.`
    } else if (score >= 40) {
        return `${location} has limited but usable charging infrastructure.`
    } else if (score >= 20) {
        return `${location} has minimal charging infrastructure. Home charging recommended.`
    } else {
        return `${location} has very limited charging infrastructure. Home charging essential.`
    }
}

export async function GET(request: NextRequest) {
    // Rate limiting
    const clientId = getClientId(request)
    const rateLimitResult = rateLimit({
        id: `ev-score-${clientId}`,
        limit: 30, // 30 requests per minute
        duration: 60000
    })

    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { 
                status: 429,
                headers: {
                    'X-RateLimit-Limit': rateLimitResult.limit.toString(),
                    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                    'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
                }
            }
        )
    }

    const searchParams = request.nextUrl.searchParams
    let lat = parseFloat(searchParams.get('lat') || '0')
    let lng = parseFloat(searchParams.get('lng') || '0')
    let address = searchParams.get('address') || ''
    const zip = searchParams.get('zip') || ''
    const county = searchParams.get('county') || ''
    const state = searchParams.get('state') || ''

    // Handle ZIP code lookup
    if (zip && !address && (!lat || !lng)) {
        const { data: zipData } = await supabaseAdmin
            .from('zip_level_data')
            .select('center_lat, center_lng, zip_code, state')
            .eq('zip_code', zip)
            .limit(1)
            .single()

        if (zipData) {
            lat = zipData.center_lat
            lng = zipData.center_lng
            address = `${zipData.zip_code}, ${zipData.state}`
        }
    }

    // Handle county/state lookup
    if (county && state && !address && (!lat || !lng)) {
        const { data: countyData } = await supabaseAdmin
            .from('county_level_data')
            .select('center_lat, center_lng, county_name, state')
            .ilike('county_name', county)
            .eq('state', state.toUpperCase())
            .limit(1)
            .single()

        if (countyData) {
            lat = countyData.center_lat
            lng = countyData.center_lng
            address = `${countyData.county_name} County, ${countyData.state}`
        }
    }

    // Handle state-only lookup
    if (state && !county && !zip && !address && (!lat || !lng)) {
        const { data: stateData } = await supabaseAdmin
            .from('state_level_data')
            .select('center_lat, center_lng, state_name')
            .ilike('state_name', state)
            .limit(1)
            .single()

        if (stateData) {
            lat = stateData.center_lat
            lng = stateData.center_lng
            address = stateData.state_name
        }
    }

    // If address is provided but no coordinates, geocode it
    if (address && (!lat || !lng)) {
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                    address
                )}.json?` +
                    `access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&` +
                    `country=US&` +
                    `limit=1`
            )

            const data = await response.json()

            if (data.features && data.features.length > 0) {
                ;[lng, lat] = data.features[0].center
                address = data.features[0].place_name
            } else {
                return NextResponse.json(
                    { error: 'Address not found' },
                    { status: 400 }
                )
            }
        } catch (error) {
            return NextResponse.json(
                { error: 'Failed to geocode address' },
                { status: 400 }
            )
        }
    }

    // Validate coordinates
    if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json(
            { error: 'Valid latitude and longitude are required' },
            { status: 400 }
        )
    }

    // Check if coordinates are in US
    if (!isValidUSCoordinates(lat, lng)) {
        return NextResponse.json(
            { error: 'Address must be in the United States' },
            { status: 400 }
        )
    }

    try {
        // Find nearest zip code data
        const { data: nearbyZips, error: zipError } = await supabaseAdmin
            .from('zip_level_data')
            .select('*')
            .gte('center_lat', lat - 0.1)
            .lte('center_lat', lat + 0.1)
            .gte('center_lng', lng - 0.1)
            .lte('center_lng', lng + 0.1)
            .limit(10)

        if (zipError) {
            logError(zipError, 'api.ev-score.zip-lookup', { lat, lng })
        }

        // Find nearest county if no zip found
        const { data: nearbyCounties, error: countyError } = await supabaseAdmin
            .from('county_level_data')
            .select('*')
            .gte('center_lat', lat - 0.5)
            .lte('center_lat', lat + 0.5)
            .gte('center_lng', lng - 0.5)
            .lte('center_lng', lng + 0.5)
            .limit(10)

        if (countyError) {
            logError(countyError, 'api.ev-score.county-lookup', { lat, lng })
        }

        // Find nearest region
        let nearestRegion = null
        let minDistance = Infinity
        let regionType = 'unknown'

        // Check zips first (more granular)
        if (nearbyZips && nearbyZips.length > 0) {
            nearbyZips.forEach((zip) => {
                const distance = calculateDistance(
                    lat,
                    lng,
                    zip.center_lat,
                    zip.center_lng
                )
                if (distance < minDistance) {
                    minDistance = distance
                    nearestRegion = zip
                    regionType = 'zip'
                }
            })
        }

        // Fall back to county if zip not found or too far
        if (
            (!nearestRegion || minDistance > 10) &&
            nearbyCounties &&
            nearbyCounties.length > 0
        ) {
            nearbyCounties.forEach((county) => {
                const distance = calculateDistance(
                    lat,
                    lng,
                    county.center_lat,
                    county.center_lng
                )
                if (distance < minDistance) {
                    minDistance = distance
                    nearestRegion = county
                    regionType = 'county'
                }
            })
        }

        if (!nearestRegion) {
            return NextResponse.json(
                { error: 'No data found for this location' },
                { status: 404 }
            )
        }

        // Use pre-aggregated data from the nearest region
        const regionData = nearestRegion as {
            ev_infrastructure_score?: number
            charger_count?: number
            fast_charger_count?: number
            avg_distance_to_charger?: number
            population?: number
            zip_code?: string
            county_name?: string
            state_name?: string
            state?: string
            center_lat: number
            center_lng: number
        }

        // Get the pre-calculated score directly from the aggregated data
        const score = Math.round(regionData.ev_infrastructure_score ?? 0)
        const grade = getGrade(score)

        // Get charger counts from pre-aggregated data
        const totalChargers = regionData.charger_count ?? 0
        const dcFastCount = regionData.fast_charger_count ?? 0
        const level2Count = Math.max(0, totalChargers - dcFastCount) // Estimate L2 as remainder
        const level1Count = 0 // L1 is rare, default to 0

        // Estimate chargers within distances based on total and avg distance
        const avgDistance = regionData.avg_distance_to_charger ?? 10
        // If average distance is small, more chargers are likely close by
        const within1Mile = avgDistance <= 1 ? Math.ceil(totalChargers * 0.3) :
                           avgDistance <= 3 ? Math.ceil(totalChargers * 0.1) : 0
        const within5Miles = avgDistance <= 5 ? totalChargers :
                            Math.ceil(totalChargers * 0.5)
        const within10Miles = totalChargers

        // Calculate breakdown scores based on available data
        // 1. Nearby chargers score (max 40 points)
        const nearbyScore = Math.min(40, Math.round((score / 100) * 40))

        // 2. Fast charging score (max 25 points)
        const fastScore = Math.min(25, Math.round((dcFastCount / Math.max(1, totalChargers)) * 25 * (score / 50)))

        // 3. Network diversity score (max 20 points) - estimate based on total charger count
        const diversityScore = totalChargers >= 10 ? 20 : totalChargers >= 5 ? 15 : totalChargers >= 2 ? 10 : 0

        // 4. Charging density score (max 15 points)
        const densityScore = Math.max(0, Math.min(15, Math.round(15 - avgDistance * 1.5)))

        // Calculate percentile (how this score compares to all ZIP codes)
        const { count: belowCount } = await supabaseAdmin
            .from('zip_level_data')
            .select('*', { count: 'exact', head: true })
            .lt('ev_infrastructure_score', score)

        const { count: totalCount } = await supabaseAdmin
            .from('zip_level_data')
            .select('*', { count: 'exact', head: true })

        const percentile = totalCount && totalCount > 0
            ? Math.round(((belowCount || 0) / totalCount) * 100)
            : 50

        const location = address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`

        const response = {
            success: true,
            score,
            grade,
            percentile,
            location,
            latitude: lat,
            longitude: lng,
            message: getScoreMessage(score, location),
            address,
            coordinates: { lat, lng },
            breakdown: {
                nearby_chargers: nearbyScore,
                fast_charging: fastScore,
                network_diversity: diversityScore,
                charging_density: densityScore
            },
            region: {
                name:
                    regionData.zip_code ||
                    regionData.county_name ||
                    regionData.state_name ||
                    'Unknown',
                type: regionType,
                population: regionData.population || null,
                distance: minDistance
            },
            chargers: {
                within_1_mile: within1Mile,
                within_5_miles: within5Miles,
                within_10_miles: within10Miles,
                dcfast_count: dcFastCount,
                level2_count: level2Count,
                level1_count: level1Count,
                total: totalChargers,
                nearest: avgDistance < 50
                    ? {
                          name: null,
                          distance: avgDistance,
                          type: dcFastCount > 0 ? 'dcfast' : 'level2',
                          address: null
                      }
                    : null
            },
            nearest_charger_miles: avgDistance < 50 ? avgDistance : null,
            chargers_within_5mi: within5Miles
        }
        
        // Validate response
        const validatedResponse = validateResponse(
            EVScoreResponseSchema,
            response,
            'ev-score'
        )
        
        return NextResponse.json(validatedResponse)
    } catch (error) {
        logError(error, 'api.ev-score', { lat, lng, address })
        return NextResponse.json(
            { error: 'Failed to calculate EV score' },
            { status: 500 }
        )
    }
}
