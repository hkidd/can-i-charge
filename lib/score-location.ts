import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { distanceMiles } from './nearby-stations'
import { getCountyIndex } from './region-geography'
import type { ScoreInputs } from './regional-score'
import { US_STATES } from './us-states'

export class ScoreLocationError extends Error {
    constructor(message: string, public status: number) { super(message) }
}

interface RegionRow extends ScoreInputs {
    center_lat: number
    center_lng: number
    zip_code?: string
    county_name?: string
    state_name?: string
    state?: string
}

const regionSchema = z.object({
    center_lat: z.number().finite().min(-90).max(90),
    center_lng: z.number().finite().min(-180).max(180)
}).passthrough()

function regionRow(value: unknown): RegionRow {
    const result = regionSchema.safeParse(value)
    if (!result.success) throw new ScoreLocationError('Region data is incomplete', 503)
    return result.data
}

function checkDatabaseError(error: { message: string } | null) {
    if (error) throw new ScoreLocationError('Region lookup is temporarily unavailable', 503)
}

function normalizedCountyName(name: string): string {
    return name.replace(/\s+(County|Parish|Borough|Census Area|Municipality|City and Borough)$/i, '').trim().toLowerCase()
}

export async function resolveScoreLocation(params: URLSearchParams, getDatabase: () => SupabaseClient) {
    const latitude = params.get('lat')
    const longitude = params.get('lng')
    const hasCoordinates = latitude !== null || longitude !== null
    let lat = Number(latitude)
    let lng = Number(longitude)
    let address = params.get('address')?.trim() ?? ''
    const zip = params.get('zip')?.trim() ?? ''
    const countyName = params.get('county')?.trim() ?? ''
    const stateName = params.get('state')?.trim() ?? ''
    const state = US_STATES.find(item => item.code === stateName.toUpperCase() || item.name.toLowerCase() === stateName.toLowerCase())
    const signal = AbortSignal.timeout(15000)

    if (hasCoordinates && (!latitude?.trim() || !longitude?.trim() ||
        !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
        throw new ScoreLocationError('Valid latitude and longitude are required', 400)
    }
    if (address.length > 500 || countyName.length > 200) throw new ScoreLocationError('Location is too long', 400)
    if (zip && !/^\d{5}$/.test(zip)) throw new ScoreLocationError('A five-digit ZIP code is required', 400)
    if (stateName && !state) throw new ScoreLocationError('A valid US state name or abbreviation is required', 400)
    if (countyName && !state) throw new ScoreLocationError('County lookup requires a state', 400)
    if ((hasCoordinates || address) && (zip || countyName || stateName)) {
        throw new ScoreLocationError('Choose coordinates, an address, or a region lookup', 400)
    }
    if (zip && countyName) throw new ScoreLocationError('Choose either a ZIP or a county', 400)

    const database = getDatabase()
    let data: RegionRow
    let type: 'zip' | 'county' | 'state'
    let match: 'requested_region' | 'boundary'
    if (zip || countyName || state) {
        // Explicit region requests retain that region, even when another center is closer.
        type = zip ? 'zip' : countyName ? 'county' : 'state'
        const table = type === 'zip' ? 'zip_level_data' : type === 'county' ? 'county_level_data' : 'state_level_data'
        let query = database.from(table).select('*')
        if (zip) {
            query = query.eq('zip_code', zip)
            if (state) query = query.eq('state', state.code)
        } else if (countyName) {
            const normalized = normalizedCountyName(countyName)
            const county = getCountyIndex().counties.find(item => item.state === state?.code && normalizedCountyName(item.name) === normalized)
            if (!county) throw new ScoreLocationError('County not found', 404)
            query = query.eq('county_fips', county.fips)
        } else if (state) {
            query = query.eq('state_name', state.name)
        }
        const result = await query.abortSignal(signal).maybeSingle()
        checkDatabaseError(result.error)
        if (!result.data) throw new ScoreLocationError('Region not found', 404)
        data = regionRow(result.data)
        lat = data.center_lat
        lng = data.center_lng
        address = [data.zip_code ?? data.county_name ?? data.state_name, data.state].filter(Boolean).join(', ')
        match = 'requested_region'
    } else {
        if (!hasCoordinates) {
            if (!address) throw new ScoreLocationError('Provide coordinates, an address, or a region', 400)
            const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
            if (!token) throw new ScoreLocationError('Address lookup is not configured', 503)
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?` +
                new URLSearchParams({ access_token: token, country: 'US', limit: '1' }),
                { signal, cache: 'no-store' }
            )
            if (!response.ok) throw new ScoreLocationError('Address lookup is temporarily unavailable', 503)
            const geocoded = z.object({ features: z.array(z.object({
                center: z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]),
                place_name: z.string()
            })) }).parse(await response.json())
            const feature = geocoded.features[0]
            if (!feature) throw new ScoreLocationError('Address not found', 404)
            lng = feature.center[0]
            lat = feature.center[1]
            address = feature.place_name
        }

        const zipResult = await database.rpc('find_zip_region', { p_lat: lat, p_lng: lng }).abortSignal(signal)
        // An older deployment without this optional RPC can still use exact county boundaries.
        if (zipResult.error && zipResult.error.code !== 'PGRST202') checkDatabaseError(zipResult.error)
        if (Array.isArray(zipResult.data) && zipResult.data.length) {
            data = regionRow(zipResult.data[0])
            type = 'zip'
        } else {
            const county = getCountyIndex().locatePoint(lng, lat)
            if (!county) throw new ScoreLocationError('No US region boundary found for this location', 404)
            const result = await database.from('county_level_data').select('*')
                .eq('county_fips', county.fips).abortSignal(signal).maybeSingle()
            checkDatabaseError(result.error)
            if (!result.data) throw new ScoreLocationError('County data not found', 404)
            data = regionRow(result.data)
            type = 'county'
        }
        match = 'boundary'
    }

    return {
        data, type, match, lat, lng, address,
        name: data.zip_code ?? data.county_name ?? data.state_name ?? 'Unknown',
        centerDistance: distanceMiles(lat, lng, data.center_lat, data.center_lng)
    }
}
