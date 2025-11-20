import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateResponse, EVScoreResponseSchema } from '@/lib/api-validation'
import { logError } from '@/lib/error-handling'
import { rateLimit, getClientId } from '@/lib/rate-limit'

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

    // If address is provided but no coordinates, geocode it first
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

        // Get nearby chargers for detailed breakdown
        const { data: nearbyChargers, error: chargersError } =
            await supabaseAdmin
                .from('charging_stations')
                .select('*')
                .gte('latitude', lat - 0.15)
                .lte('latitude', lat + 0.15)
                .gte('longitude', lng - 0.15)
                .lte('longitude', lng + 0.15)

        if (chargersError) {
            logError(chargersError, 'api.ev-score.chargers-lookup', { lat, lng })
        }

        // Calculate distances to chargers
        const chargersWithDistance = (nearbyChargers || [])
            .map((charger) => ({
                ...charger,
                distance: calculateDistance(
                    lat,
                    lng,
                    charger.latitude,
                    charger.longitude
                )
            }))
            .sort((a, b) => a.distance - b.distance)

        // Count chargers within different radii
        const within1Mile = chargersWithDistance.filter(
            (c) => c.distance <= 1
        ).length
        const within5Miles = chargersWithDistance.filter(
            (c) => c.distance <= 5
        ).length
        const within10Miles = chargersWithDistance.filter(
            (c) => c.distance <= 10
        ).length

        // Count by type
        const dcFastCount = chargersWithDistance.filter(
            (c) => c.charger_type_detailed === 'dcfast'
        ).length
        const level2Count = chargersWithDistance.filter(
            (c) => c.charger_type_detailed === 'level2'
        ).length
        const level1Count = chargersWithDistance.filter(
            (c) => c.charger_type_detailed === 'level1'
        ).length

        // Get nearest charger
        const nearestCharger = chargersWithDistance[0] || null

        // Calculate fast charger percentage
        const totalChargers = within10Miles || 1
        const fastChargerPercentage = Math.round(
            (dcFastCount / totalChargers) * 100
        )

        const location = address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        const score = (nearestRegion as any).ev_infrastructure_score || 0

        const response = {
            success: true,
            score,
            location,
            latitude: lat,
            longitude: lng,
            message: getScoreMessage(score, location),
            address,
            coordinates: { lat, lng },
            region: {
                name:
                    (nearestRegion as any).zip_code ||
                    (nearestRegion as any).county_name ||
                    (nearestRegion as any).state_name ||
                    'Unknown',
                type: regionType,
                population: (nearestRegion as any).population || null,
                distance: minDistance
            },
            chargers: {
                within_1_mile: within1Mile,
                within_5_miles: within5Miles,
                within_10_miles: within10Miles,
                dcfast_count: dcFastCount,
                level2_count: level2Count,
                level1_count: level1Count,
                total: chargersWithDistance.length,
                nearest: nearestCharger
                    ? {
                          name: nearestCharger.name,
                          distance: nearestCharger.distance,
                          type: nearestCharger.charger_type_detailed,
                          address: nearestCharger.address
                      }
                    : null
            },
            // Legacy format support
            nearest_charger_distance: nearestCharger?.distance || null,
            chargers_1mi: within1Mile,
            chargers_5mi: within5Miles,
            chargers_10mi: within10Miles,
            fast_charger_count: dcFastCount,
            fast_charger_percentage: fastChargerPercentage
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
