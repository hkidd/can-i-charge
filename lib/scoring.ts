import { supabase } from './supabase'

interface ScoreComponents {
    baseScore: number
    within1miScore: number
    within5miScore: number
    fastChargerBonus: number
    highwayBonus: number
    densityBonus: number
}

export async function calculateEVScore(
    lat: number,
    lng: number
): Promise<{ score: number; components: ScoreComponents; details: any }> {
    // Step 1: Find all charging stations within 10 miles
    // Using rough approximation: 1 degree ≈ 69 miles
    const searchRadius = 10 / 69 // ~0.145 degrees

    const { data: nearbyChargers, error } = await supabase
        .from('charging_stations')
        .select('*')
        .gte('latitude', lat - searchRadius)
        .lte('latitude', lat + searchRadius)
        .gte('longitude', lng - searchRadius)
        .lte('longitude', lng + searchRadius)

    if (error || !nearbyChargers) {
        // Return a basic score if no data
        return {
            score: 0,
            components: {
                baseScore: 0,
                within1miScore: 0,
                within5miScore: 0,
                fastChargerBonus: 0,
                highwayBonus: 0,
                densityBonus: 0
            },
            details: { chargers_1mi: 0, chargers_5mi: 0, chargers_10mi: 0 }
        }
    }

    // Step 2: Calculate distances and categorize chargers
    const chargersWithDistance = nearbyChargers.map((charger) => ({
        ...charger,
        distance: calculateDistance(
            lat,
            lng,
            charger.latitude,
            charger.longitude
        )
    }))

    const within1mi = chargersWithDistance.filter((c) => c.distance <= 1)
    const within5mi = chargersWithDistance.filter((c) => c.distance <= 5)
    const within10mi = chargersWithDistance.filter((c) => c.distance <= 10)
    const fastChargers = within10mi.filter((c) => c.charger_type === 'dcfast')

    // Step 3: Calculate score components
    const components: ScoreComponents = {
        baseScore: within10mi.length > 0 ? 20 : 0,
        within1miScore: Math.min(within1mi.length * 3, 30),
        within5miScore: Math.min(within5mi.length * 1, 20),
        fastChargerBonus: Math.min(fastChargers.length * 2, 15),
        highwayBonus: 0, // We'll add this later with highway data
        densityBonus: 0 // We'll add this later with regional comparisons
    }

    const totalScore = Math.min(
        components.baseScore +
            components.within1miScore +
            components.within5miScore +
            components.fastChargerBonus +
            components.highwayBonus +
            components.densityBonus,
        100
    )

    return {
        score: totalScore,
        components,
        details: {
            chargers_1mi: within1mi.length,
            chargers_5mi: within5mi.length,
            chargers_10mi: within10mi.length,
            fast_charger_count: fastChargers.length,
            fast_charger_percentage:
                within10mi.length > 0
                    ? Math.round(
                          (fastChargers.length / within10mi.length) * 100
                      )
                    : 0,
            nearest_charger:
                chargersWithDistance.length > 0
                    ? Math.min(...chargersWithDistance.map((c) => c.distance))
                    : null
        }
    }
}

// Haversine formula for calculating distance between two lat/lng points
export function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 3959 // Earth's radius in miles
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

function toRad(degrees: number): number {
    return degrees * (Math.PI / 180)
}

export function getScoreMessage(score: number, location: string): string {
    if (score >= 80) {
        return `Excellent! ${location} has multiple nearby charging options.`
    } else if (score >= 60) {
        return `Good! ${location} has adequate charging infrastructure.`
    } else if (score >= 40) {
        return `Fair. ${location} has limited but usable charging options.`
    } else if (score >= 20) {
        return `Poor. ${location} has minimal charging infrastructure.`
    } else {
        return `Very limited. ${location} has severely limited charging options.`
    }
}

export function calculateNeedScore(
    population: number,
    chargerCount: number,
    avgDistance?: number
): number {
    // Higher score = greater infrastructure gap
    // Formula: (population / 10000) - (charger_count * 5) + (distance penalty)

    const populationFactor = population / 10000
    const chargerFactor = chargerCount * 5
    const distancePenalty = avgDistance ? Math.min(avgDistance * 2, 20) : 0

    const needScore = populationFactor - chargerFactor + distancePenalty

    // Normalize to 0-100 range
    return Math.max(0, Math.min(100, needScore))
}
