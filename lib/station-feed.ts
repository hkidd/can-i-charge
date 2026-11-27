import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import chain from 'stream-chain'
import parser from 'stream-json/parser.js'
import pick from 'stream-json/filters/pick.js'
import streamArray from 'stream-json/streamers/stream-array.js'
import { processNRELStation, type Station } from './station-model'
import { RefreshError } from './refresh-store'

export const STATION_FEED_URL = 'https://developer.nlr.gov/api/alt-fuel-stations/v1.json'

/** Retain normalized stations only; never buffer the national raw JSON response. */
export async function readStationFeed(response: Response, minimum = 40000, requireResultCount = false) {
    if (!response.ok || !response.body) throw new RefreshError(`Station provider returned HTTP ${response.status}`)
    const contentType = response.headers.get('content-type')
    if (contentType && !contentType.includes('json')) throw new RefreshError('Station provider did not return JSON')
    let depth = 0, countDepth: number | null = null, expectedCount: number | undefined
    const metadata = (token: parser.Token) => {
        if (token.name === 'startObject' || token.name === 'startArray') depth++
        if (token.name === 'keyValue' && depth <= 2) countDepth = token.value === 'total_results' ? depth : null
        if (token.name === 'numberValue' && countDepth === depth) {
            const count = Number(token.value)
            if (!Number.isSafeInteger(count) || count < 0) throw new RefreshError('Invalid station result count')
            if (expectedCount !== undefined && expectedCount !== count) throw new RefreshError('Conflicting station result counts')
            expectedCount = count
            countDepth = null
        }
        if (token.name === 'endObject' || token.name === 'endArray') depth--
        return token
    }
    // Keep token processing in one synchronous pipeline. A Web TransformStream
    // boundary for every token made the 286 MB national feed exceed its deadline.
    const stream = chain([
        // DOM and Node declare different BYOB generics for the same Web Stream.
        Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
        parser({ streamValues: false }), metadata,
        pick({ filter: 'fuel_stations' }), streamArray()
    ])
    const stations: Station[] = []
    const ids = new Set<number>()
    let received = 0, rejected = 0
    try {
        for await (const value of stream) {
            received++
            if (received > 1000000) throw new RefreshError('Station feed exceeded the supported size')
            const record = value as { value: unknown }
            let station: Station
            try { station = processNRELStation(record.value) }
            catch { rejected++; continue }
            if (ids.has(station.source_id)) throw new RefreshError('Station provider returned duplicate station IDs')
            ids.add(station.source_id)
            stations.push(station)
        }
    } finally { stream.destroy() }
    if ((requireResultCount && expectedCount === undefined) || (expectedCount !== undefined && expectedCount !== received)) {
        throw new RefreshError('Station provider returned an incomplete result set')
    }
    const knownCapacity = stations.filter(station => station.port_counts_known && (station.num_ports ?? 0) > 0).length
    if (stations.length < minimum || rejected > received * 0.05 || knownCapacity < stations.length * 0.9) {
        throw new RefreshError(`Station feed failed quality checks (${stations.length} accepted, ${rejected} rejected)`)
    }
    return { stations, received, rejected }
}

export async function fetchStationSnapshot(signal: AbortSignal) {
    const key = process.env.NLR_API_KEY || process.env.NREL_API_KEY
    if (!key?.trim()) throw new RefreshError('Station provider API key is not configured', 503)
    const url = new URL(STATION_FEED_URL)
    url.search = new URLSearchParams({ api_key: key, fuel_type: 'ELEC', country: 'US', status: 'E', access: 'public', limit: 'all' }).toString()
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]) })
    return readStationFeed(response, 40000, true)
}
