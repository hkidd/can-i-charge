import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './db-pagination'
import type { Station } from './station-model'

const EARTH_RADIUS_MILES = 3959
const SEARCH_RADIUS_MILES = 10
const DEGREES_TO_RADIANS = Math.PI / 180

export type NearbyStation = Pick<Station,
    'id' | 'name' | 'latitude' | 'longitude' | 'address' | 'charger_type' |
    'level1_ports' | 'level2_ports' | 'dcfast_ports'>

export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const latitudeDifference = (lat2 - lat1) * DEGREES_TO_RADIANS
    const longitudeDifference = (lng2 - lng1) * DEGREES_TO_RADIANS
    const haversine = Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(lat1 * DEGREES_TO_RADIANS) * Math.cos(lat2 * DEGREES_TO_RADIANS) *
        Math.sin(longitudeDifference / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(Math.min(1, haversine)))
}

export function nearbySearchBounds(lat: number, lng: number) {
    const angularRadius = SEARCH_RADIUS_MILES / EARTH_RADIUS_MILES
    const latitudeRadius = angularRadius / DEGREES_TO_RADIANS
    const south = Math.max(-90, lat - latitudeRadius)
    const north = Math.min(90, lat + latitudeRadius)
    if (south === -90 || north === 90) {
        return { south, north, longitudeRanges: [[-180, 180]] }
    }

    const longitudeRadius = Math.asin(Math.sin(angularRadius) / Math.cos(lat * DEGREES_TO_RADIANS)) /
        DEGREES_TO_RADIANS
    const west = lng - longitudeRadius
    const east = lng + longitudeRadius
    // A circle crossing the date line needs two longitude queries.
    let longitudeRanges = [[west, east]]
    if (west < -180) longitudeRanges = [[-180, east], [west + 360, 180]]
    if (east > 180) longitudeRanges = [[west, 180], [-180, east - 360]]
    return { south, north, longitudeRanges }
}

export function summarizeNearbyStations(stations: NearbyStation[], lat: number, lng: number) {
    const seen = new Set<string>()
    const nearby = []
    for (const station of stations) {
        if (seen.has(station.id)) continue
        seen.add(station.id)
        const distance = distanceMiles(lat, lng, station.latitude, station.longitude)
        if (Number.isFinite(distance) && distance <= SEARCH_RADIUS_MILES) {
            nearby.push({ station, distance })
        }
    }
    nearby.sort((a, b) => a.distance - b.distance || a.station.id.localeCompare(b.station.id))
    const closest = nearby[0]
    return {
        within_1_mile: nearby.filter(site => site.distance <= 1).length,
        within_5_miles: nearby.filter(site => site.distance <= 5).length,
        within_10_miles: nearby.length,
        // A site with multiple charging speeds belongs to each applicable speed count.
        dcfast_within_1_mile: nearby.filter(site => site.station.dcfast_ports > 0 && site.distance <= 1).length,
        dcfast_within_5_miles: nearby.filter(site => site.station.dcfast_ports > 0 && site.distance <= 5).length,
        dcfast_within_10_miles: nearby.filter(site => site.station.dcfast_ports > 0).length,
        dcfast_count: nearby.filter(site => site.station.dcfast_ports > 0).length,
        level2_count: nearby.filter(site => site.station.level2_ports > 0).length,
        level1_count: nearby.filter(site => site.station.level1_ports > 0).length,
        total: nearby.length,
        nearest: closest ? {
            name: closest.station.name,
            distance: closest.distance,
            type: closest.station.charger_type,
            address: closest.station.address
        } : null
    }
}

export async function loadNearbyStations(database: SupabaseClient, lat: number, lng: number) {
    const bounds = nearbySearchBounds(lat, lng)
    const signal = AbortSignal.timeout(15000)
    const stations: NearbyStation[] = []
    for (const [west, east] of bounds.longitudeRanges) {
        const rows = await readAllPages<NearbyStation>((from, to) => database
            .from('charging_stations')
            .select('id,name,latitude,longitude,address,charger_type,level1_ports,level2_ports,dcfast_ports').eq('restricted_access', false)
            .gte('latitude', bounds.south).lte('latitude', bounds.north)
            .gte('longitude', west).lte('longitude', east)
            .order('id').range(from, to).abortSignal(signal))
        stations.push(...rows)
    }
    return summarizeNearbyStations(stations, lat, lng)
}
