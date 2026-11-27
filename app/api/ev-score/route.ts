import { validateApiKey } from '@/lib/api-keys'
import { resolveScoreLocation, ScoreLocationError } from '@/lib/score-location'
import { calculateRegionalScore, getScoreDataQuality, selectScoreInputs, DEFAULT_SCORE_FILTERS, SCORING_VERSION } from '@/lib/regional-score'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { validateResponse, EVScoreResponseSchema } from '@/lib/api-validation'
import { logError } from '@/lib/error-handling'
import { rateLimit, getClientId } from '@/lib/rate-limit'
import { loadNearbyStations } from '@/lib/nearby-stations'

// Convert score to letter grade
function getGrade(score: number | null): string {
    if (score === null) return 'Unrated'
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

// Helper: Get score message
function getScoreMessage(score: number | null, location: string): string {
    if (score === null) return `There is not enough verified regional data to rate ${location}. Nearby station counts are shown separately.`
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
    const authorization = request.headers.get('authorization')
    let requestsRemaining: number | undefined
    if (authorization !== null) {
        const match = /^Bearer (cic_live_[A-Za-z0-9_-]{32})$/.exec(authorization)
        if (!match) return NextResponse.json({ error: 'A valid bearer API key is required' }, { status: 401 })
        const key = await validateApiKey(match[1])
        if (!key.valid) {
            const status = key.reason === 'unavailable' ? 503 : key.reason === 'quota' ? 429 : 401
            return NextResponse.json({ error: status === 503 ? 'API quota service is unavailable' :
                status === 429 ? 'Daily API quota exceeded' : 'API key is invalid or inactive' }, { status })
        }
        requestsRemaining = key.remainingRequests
    } else {
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
    }

    try {
        const resolved = await resolveScoreLocation(request.nextUrl.searchParams, getSupabaseAdmin)
        const { lat, lng, address, data: regionData, type: regionType } = resolved
        const { score, breakdown, evidence } = calculateRegionalScore(regionData)
        const grade = getGrade(score)
        const chargers = await loadNearbyStations(getSupabaseAdmin(), lat, lng)
        // Deprecated compatibility field: readiness is absolute, not a peer rank.
        const percentile = null

        const location = address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`

        const response = {
            success: true,
            score,
            grade,
            percentile,
            location,
            latitude: lat,
            longitude: lng,
            message: evidence?.summary ?? getScoreMessage(score, location),
            evidence,
            address,
            coordinates: { lat, lng },
            scoring_version: SCORING_VERSION,
            data_quality: getScoreDataQuality(selectScoreInputs(regionData, DEFAULT_SCORE_FILTERS) ?? {}),
            breakdown,
            region: {
                name: resolved.name,
                type: regionType,
                match: resolved.match,
                population: regionData.population ?? null,
                distance: resolved.centerDistance
            },
            chargers,
            nearest_charger_miles: chargers.nearest?.distance ?? null,
            chargers_within_5mi: chargers.within_5_miles
        }

        // Validate response
        const validatedResponse = validateResponse(
            EVScoreResponseSchema,
            response,
            'ev-score'
        )

        return NextResponse.json(validatedResponse, {
            headers: requestsRemaining === undefined ? {} : {
                'X-RateLimit-Limit': '1000',
                'X-RateLimit-Remaining': String(requestsRemaining)
            }
        })
    } catch (error) {
        if (error instanceof ScoreLocationError) {
            return NextResponse.json({ error: error.message }, { status: error.status })
        }
        logError(error, 'api.ev-score')
        return NextResponse.json(
            { error: 'Failed to calculate EV score' },
            { status: 503 }
        )
    }
}
