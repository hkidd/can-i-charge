// Geocoding: Convert address to coordinates
export async function geocodeAddress(address: string): Promise<{
    latitude: number
    longitude: number
    formatted_address: string
} | null> {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

    if (!mapboxToken) {
        console.error('Mapbox token not configured')
        return null
    }

    try {
        const encodedAddress = encodeURIComponent(address)
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&country=US&limit=1`

        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Geocoding failed: ${response.status}`)
        }

        const data = await response.json()

        if (data.features && data.features.length > 0) {
            const feature = data.features[0]
            return {
                longitude: feature.center[0],
                latitude: feature.center[1],
                formatted_address: feature.place_name
            }
        }

        return null
    } catch (error) {
        console.error('Geocoding error:', error)
        return null
    }
}

// Reverse geocoding: Convert coordinates to address
export async function reverseGeocode(
    lat: number,
    lng: number
): Promise<string | null> {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

    if (!mapboxToken) {
        console.error('Mapbox token not configured')
        return null
    }

    try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`

        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Reverse geocoding failed: ${response.status}`)
        }

        const data = await response.json()

        if (data.features && data.features.length > 0) {
            return data.features[0].place_name
        }

        return null
    } catch (error) {
        console.error('Reverse geocoding error:', error)
        return null
    }
}

// Fetch charging stations from NREL
export async function fetchNRELChargingStations(
    state?: string
): Promise<any[] | null> {
    const apiKey = process.env.NREL_API_KEY

    if (!apiKey) {
        console.error('NREL API key not configured')
        return null
    }

    try {
        const stateParam = state ? `&state=${state}` : ''
        const url = `https://developer.nrel.gov/api/alt-fuel-stations/v1.json?api_key=${apiKey}&fuel_type=ELEC&country=US${stateParam}&limit=all`

        const response = await fetch(url, {
            next: { revalidate: 86400 } // Cache for 24 hours
        })

        if (!response.ok) {
            throw new Error(`NREL API failed: ${response.status}`)
        }

        const data = await response.json()
        return data.fuel_stations || []
    } catch (error) {
        console.error('NREL API error:', error)
        return null
    }
}
