import countyTopology from 'us-atlas/counties-10m.json'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { Polygon, MultiPolygon, Position } from 'geojson'
import { getStateCodeFromFIPS } from './map-utils'
import { US_STATES } from './us-states'

export interface CountyBoundary {
    fips: string; name: string; state: string; lat: number; lng: number
    polygons: Position[][][]
}
function ringContains(ring: Position[], lng: number, lat: number): boolean {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[i], [x2, y2] = ring[j]
        const cross = (lng - x1) * (y2 - y1) - (lat - y1) * (x2 - x1)
        if (Math.abs(cross) < 1e-10 && lng >= Math.min(x1, x2) && lng <= Math.max(x1, x2) && lat >= Math.min(y1, y2) && lat <= Math.max(y1, y2)) return true
        if ((y1 > lat) !== (y2 > lat) && lng < (x2 - x1) * (lat - y1) / (y2 - y1) + x1) inside = !inside
    }
    return inside
}
export function polygonContains(polygon: Position[][], lng: number, lat: number): boolean {
    return !!polygon[0]?.length && ringContains(polygon[0], lng, lat) && !polygon.slice(1).some(hole => ringContains(hole, lng, lat))
}
function extent(ring: Position[]) {
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity
    for (const [lng, lat] of ring) { west = Math.min(west, lng); east = Math.max(east, lng); south = Math.min(south, lat); north = Math.max(north, lat) }
    return { west, east, south, north }
}

export class CountyIndex {
    private readonly cells = new Map<string, Set<CountyBoundary>>()
    constructor(public readonly counties: CountyBoundary[]) {
        for (const county of [...counties].sort((a, b) => a.fips.localeCompare(b.fips))) {
            for (const polygon of county.polygons) {
                const box = extent(polygon[0])
                for (let x = Math.floor(box.west); x <= Math.floor(box.east); x++) {
                    for (let y = Math.floor(box.south); y <= Math.floor(box.north); y++) {
                        const key = `${county.state}:${x}:${y}`
                        if (!this.cells.has(key)) this.cells.set(key, new Set())
                        this.cells.get(key)!.add(county)
                    }
                }
            }
        }
    }
    locate(state: string, lng: number, lat: number): CountyBoundary | undefined {
        const candidates = this.cells.get(`${state}:${Math.floor(lng)}:${Math.floor(lat)}`)
        for (const county of candidates ?? []) if (county.polygons.some(polygon => polygonContains(polygon, lng, lat))) return county
        return undefined
    }
    locatePoint(lng: number, lat: number): CountyBoundary | undefined {
        for (const state of US_STATES) {
            const county = this.locate(state.code, lng, lat)
            if (county) return county
        }
        return undefined
    }
}
let cached: CountyIndex | undefined
export function getCountyIndex(): CountyIndex {
    if (cached) return cached
    const topology = countyTopology as unknown as Topology<{ counties: GeometryCollection<{ name: string }> }>
    const collection = feature(topology, topology.objects.counties)
    const counties: CountyBoundary[] = []
    for (const item of collection.features) {
        if (!item.geometry || !['Polygon', 'MultiPolygon'].includes(item.geometry.type)) continue
        const fips = String(item.id).padStart(5, '0')
        const state = getStateCodeFromFIPS(fips.slice(0, 2))
        if (!state) continue
        const geometry = item.geometry as Polygon | MultiPolygon
        const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
        // Center of the largest component avoids a dateline-wide center for island counties.
        const boxes = polygons.map(polygon => extent(polygon[0]))
            .sort((a, b) => (b.east - b.west) * (b.north - b.south) - (a.east - a.west) * (a.north - a.south))
        const box = boxes[0]
        counties.push({ fips, state, name: String(item.properties?.name ?? fips), lat: (box.south + box.north) / 2, lng: (box.west + box.east) / 2, polygons })
    }
    cached = new CountyIndex(counties)
    return cached
}
