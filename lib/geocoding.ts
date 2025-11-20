import { geocodeAddress, reverseGeocode } from './api-fetchers'

export interface GeocodingResult {
    success: boolean
    latitude?: number
    longitude?: number
    formatted_address?: string
    error?: string
}

export async function searchAddress(query: string): Promise<GeocodingResult> {
    if (!query || query.trim().length === 0) {
        return {
            success: false,
            error: 'Address cannot be empty'
        }
    }

    const result = await geocodeAddress(query)

    if (!result) {
        return {
            success: false,
            error: 'Address not found. Please try a different search.'
        }
    }

    return {
        success: true,
        latitude: result.latitude,
        longitude: result.longitude,
        formatted_address: result.formatted_address
    }
}

export async function getAddressFromCoordinates(
    lat: number,
    lng: number
): Promise<string> {
    const address = await reverseGeocode(lat, lng)
    return address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

// Validate US coordinates
export function isValidUSCoordinates(lat: number, lng: number): boolean {
    // Continental US rough bounds
    const isInContinentalUS =
        lat >= 24.5 && lat <= 49.4 && lng >= -125 && lng <= -66.9

    // Alaska
    const isInAlaska =
        lat >= 51.2 && lat <= 71.4 && lng >= -179.1 && lng <= -129.9

    // Hawaii
    const isInHawaii =
        lat >= 18.9 && lat <= 22.2 && lng >= -160.2 && lng <= -154.8

    return isInContinentalUS || isInAlaska || isInHawaii
}
