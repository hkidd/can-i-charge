import { escapeHtml } from './html'
import { stationCapacity } from './station-filters'
import type { Station } from './station-model'
import { readAllPages } from './db-pagination'
import mapboxgl from 'mapbox-gl'
import * as topojson from 'topojson-client'
import { supabase } from './supabase'
import { applyFiltersToData, getStateCodeFromFIPS } from './map-utils'
import {
    createPolygonLayers,
    createChargerPointsLayer,
    createTextLabels,
    removeExistingLayers
} from './map-layers'
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { ScoreDataQuality, ScoreFilters, ScoreInputs } from './regional-score'

interface ChargerPoint {
    name: string | null
    level1_ports: number
    level2_ports: number
    dcfast_ports: number
    port_counts_known: boolean
    charging_units: Station['charging_units']
    charging_units_complete: boolean
    latitude: number
    longitude: number
    charger_type_detailed: string | null
    network: string | null
    address: string | null
    num_ports: number | null
    ev_connector_types: string[] | null
    charging_level?: string
    access_code?: string
    max_power_kw?: number
}

interface MapRegion extends ScoreInputs {
    state_name?: string
    county_name?: string
    zip_code?: string
    state?: string
    geometry?: Geometry
}
type FilteredRegion = MapRegion & { score: number | null; filtered_charger_count: number | null; data_quality: ScoreDataQuality; traffic_message: string | null; model_message: string }
const mapsWithPointHandlers = new WeakSet<mapboxgl.Map>()
interface MapLoad { controller: AbortController }
const regionLoads = new WeakMap<mapboxgl.Map, MapLoad>()
const pointLoads = new WeakMap<mapboxgl.Map, MapLoad>()

function beginLoad(loads: WeakMap<mapboxgl.Map, MapLoad>, map: mapboxgl.Map) {
    loads.get(map)?.controller.abort()
    const request = { controller: new AbortController() }
    loads.set(map, request)
    return request
}
export function cancelMapLoads(map: mapboxgl.Map) {
    regionLoads.get(map)?.controller.abort()
    pointLoads.get(map)?.controller.abort()
}
async function fetchMapData(url: string, signal: AbortSignal) {
    const response = await fetch(url, { signal })
    if (!response.ok) {
        window.dispatchEvent(new Event('cic:data-unavailable'))
        throw new Error('Charging data is temporarily unavailable')
    }
    const body = await response.json()
    window.dispatchEvent(new Event('cic:data-available'))
    return body as { data: MapRegion[] }
}


const applyThemeColors = (map: mapboxgl.Map, opportunityMode: boolean = false) => {
    if (map.getLayer('region-fills')) {
        if (opportunityMode) {
            map.setPaintProperty('region-fills', 'fill-color', [
                'interpolate', ['linear'], ['number', ['get', 'score'], -1],
                -1, '#64748b', 0, '#059669', 35, '#10b981', 50, '#f59e0b', 75, '#ef4444', 100, '#b91c1c'
            ])
        } else {
            // Normal mode: Purple to Emerald (high contrast)
            map.setPaintProperty('region-fills', 'fill-color', [
                'interpolate',
                ['linear'],
                ['number', ['get', 'score'], -1],
                -1,
                '#64748b',
                0,
                '#581c87', // Purple-800
                35,
                '#6d28d9', // Violet-700
                50,
                '#2563eb', // Blue-600
                75,
                '#0891b2', // Cyan-600
                100,
                '#059669' // Emerald-600
            ])
        }

        // Dynamic opacity: Better scores = Brighter glass
        map.setPaintProperty('region-fills', 'fill-opacity', [
            'interpolate',
            ['linear'],
            ['number', ['get', 'score'], 0],
            0,
            0.3,
            100,
            0.5
        ])
    }

    if (map.getLayer('region-borders')) {
        if (opportunityMode) {
            map.setPaintProperty('region-borders', 'line-color', [
                'interpolate', ['linear'], ['number', ['get', 'score'], -1],
                -1, '#64748b', 0, '#10b981', 50, '#f59e0b', 100, '#ef4444'
            ])
        } else {
            // Normal mode borders
            map.setPaintProperty('region-borders', 'line-color', [
                'interpolate',
                ['linear'],
                ['number', ['get', 'score'], -1],
                -1,
                '#64748b',
                0,
                '#a855f7', // Purple-500
                50,
                '#22d3ee', // Cyan-400
                100,
                '#34d399' // Emerald-400
            ])
        }
        map.setPaintProperty('region-borders', 'line-opacity', 0.5)
    }
}

export async function loadStatePolygons(
    map: mapboxgl.Map,
    filters: ScoreFilters,
    setupInteractions: (type: string) => void,
    onError?: (error: Error) => void
) {
    const request = beginLoad(regionLoads, map)
    try {
        const topoResponse = await fetch(
            'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json', { signal: request.controller.signal }
        )
        const topology = await topoResponse.json() as Topology<{ states: GeometryCollection<{ name: string }> }>
        const statesGeo = topojson.feature(topology, topology.objects.states)

        const scoreData = await fetchMapData('/api/charging-data?zoom=4', request.controller.signal)

        const filteredData = applyFiltersToData(scoreData.data, filters)
        const filteredScoreByName: Record<string, FilteredRegion> = {}
        filteredData.forEach(state => {
            if (state.state_name) filteredScoreByName[state.state_name] = state
        })

        const features = statesGeo.features.map((feature) => {
            const stateName = feature.properties.name
            const stateData = filteredScoreByName[stateName]

            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    score: stateData?.score ?? null,
                    charger_count: stateData?.charger_count || 0,
                    filtered_charger_count:
                        stateData?.filtered_charger_count ?? null,
                    population: stateData?.population || 0,
                    state_name: stateName,
                    model_message: stateData?.model_message ?? null,
                    traffic_message: stateData?.traffic_message ?? null,
                    capacity_message: stateData?.data_quality.message ?? null,
                    unknown_port_station_count: stateData?.data_quality.unknown_capacity_station_count ?? null
                }
            }
        })

        const geojson: FeatureCollection = { type: 'FeatureCollection', features }

        if (regionLoads.get(map) !== request) return

        if (map.getSource('regions')) {
            ;(map.getSource('regions') as mapboxgl.GeoJSONSource).setData(
                geojson
            )
        } else {
            removeExistingLayers(map)

            map.addSource('regions', {
                type: 'geojson',
                data: geojson
            })

            createPolygonLayers(map)
            createTextLabels(map, 4)
            setupInteractions('polygon')
        }

        // APPLY THEME OVERRIDE
        applyThemeColors(map, filters.opportunityMode)
    } catch (error) {
        if (request.controller.signal.aborted) return
        console.error('Failed to load state polygons:', error)
        if (onError)
            onError(error instanceof Error ? error : new Error(String(error)))
    }
}

export async function loadCountyPolygons(
    map: mapboxgl.Map,
    filters: ScoreFilters,
    setupInteractions: (type: string) => void,
    onError?: (error: Error) => void
) {
    const request = beginLoad(regionLoads, map)
    try {
        const topoResponse = await fetch(
            'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json', { signal: request.controller.signal }
        )
        const topology = await topoResponse.json() as Topology<{ counties: GeometryCollection<{ name: string }> }>
        const countiesGeo = topojson.feature(
            topology,
            topology.objects.counties
        )

        const bounds = map.getBounds()
        if (!bounds) {
            throw new Error('Map bounds not available')
        }

        const zoom = Math.min(8, Math.round(map.getZoom()))

        // Expand bounds significantly to load counties beyond immediate viewport
        const buffer = 5 // degrees - much larger buffer for smooth panning
        const expandedBounds = {
            north: bounds.getNorth() + buffer,
            south: bounds.getSouth() - buffer,
            east: bounds.getEast() + buffer,
            west: bounds.getWest() - buffer
        }

        const scoreData = await fetchMapData(
            `/api/charging-data?zoom=${zoom}&` +
                `north=${expandedBounds.north}&` +
                `south=${expandedBounds.south}&` +
                `east=${expandedBounds.east}&` +
                `west=${expandedBounds.west}`, request.controller.signal
        )
        const filteredData = applyFiltersToData(scoreData.data, filters)

        const scoreByCounty: Record<string, FilteredRegion> = {}
        filteredData.forEach((county) => {
            const key = `${county.county_name}-${county.state}`
            scoreByCounty[key] = county
        })

        const features = countiesGeo.features.map((feature) => {
            const countyName = feature.properties.name
            const stateId = String(feature.id).substring(0, 2)
            const stateCode = getStateCodeFromFIPS(stateId)
            const key = `${countyName}-${stateCode}`
            const countyData = scoreByCounty[key]

            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    score: countyData?.score ?? null,
                    charger_count: countyData?.charger_count || 0,
                    filtered_charger_count:
                        countyData?.filtered_charger_count ?? null,
                    population: countyData?.population || 0,
                    county_name: countyName,
                    state: stateCode,
                    model_message: countyData?.model_message ?? null,
                    traffic_message: countyData?.traffic_message ?? null,
                    capacity_message: countyData?.data_quality.message ?? null,
                    unknown_port_station_count: countyData?.data_quality.unknown_capacity_station_count ?? null
                }
            }
        })

        const geojson: FeatureCollection = { type: 'FeatureCollection', features }

        if (regionLoads.get(map) !== request) return

        if (map.getSource('regions')) {
            ;(map.getSource('regions') as mapboxgl.GeoJSONSource).setData(
                geojson
            )
        } else {
            removeExistingLayers(map)

            map.addSource('regions', {
                type: 'geojson',
                data: geojson
            })

            createPolygonLayers(map)
            createTextLabels(map, Math.round(map.getZoom()))
            setupInteractions('polygon')
        }

        // APPLY THEME OVERRIDE
        applyThemeColors(map, filters.opportunityMode)
    } catch (error) {
        if (request.controller.signal.aborted) return
        console.error('Failed to load county polygons:', error)
        if (onError)
            onError(error instanceof Error ? error : new Error(String(error)))
    }
}

export async function loadChargerPoints(map: mapboxgl.Map, filters: ScoreFilters) {
    const request = beginLoad(pointLoads, map)
    const bounds = map.getBounds()

    if (!bounds) {
        console.warn('Map bounds not available for charger points')
        return
    }

    try {
        const speedConditions: string[] = []
        if (filters.showDCFast) speedConditions.push('dcfast_ports.gt.0')
        if (filters.showLevel2) speedConditions.push('level2_ports.gt.0')
        if (filters.showLevel1) speedConditions.push('level1_ports.gt.0')

        if (speedConditions.length === 0 || (filters.showTesla === false && filters.showCCS === false)) {
            if (map.getLayer('charger-points')) {
                map.removeLayer('charger-points')
            }
            if (map.getSource('charger-points')) {
                map.removeSource('charger-points')
            }
            return
        }

        const signal = AbortSignal.any([request.controller.signal, AbortSignal.timeout(15000)])
        const chargers = await readAllPages<ChargerPoint>((from, to) => {
            let query = supabase.from('charging_stations').select('*')
                .or(speedConditions.join(',')).eq('restricted_access', false)
                .gte('latitude', bounds.getSouth()).lte('latitude', bounds.getNorth())
                .gte('longitude', bounds.getWest()).lte('longitude', bounds.getEast())
                .order('id').range(from, to).abortSignal(signal)
            if (filters.showTesla === true && filters.showCCS === false) {
                query = query.overlaps('ev_connector_types', ['TESLA', 'NACS', 'J3400'])
            } else if (filters.showCCS === true && filters.showTesla === false) {
                query = query.overlaps('ev_connector_types', ['J1772COMBO', 'J1772', 'CHADEMO', 'J3271', 'NEMA515', 'NEMA520', 'NEMA1450'])
            }
            return query
        })

        if (pointLoads.get(map) !== request) return

        const family = filters.showTesla === false ? 'other' : filters.showCCS === false ? 'tesla' : undefined
        const features: Feature<Point>[] = (chargers || []).flatMap((charger) => {
            const capacity = stationCapacity({ ...charger, ev_connector_types: charger.ev_connector_types ?? [] }, family)
            const ports = (filters.showLevel1 ? capacity.ports.level1 : 0) +
                (filters.showLevel2 ? capacity.ports.level2 : 0) + (filters.showDCFast ? capacity.ports.dcfast : 0)
            // Station-level speed and connector matches can refer to different
            // charging units. Require the selected combination at the same unit.
            if (!capacity.known || !capacity.compatible || ports <= 0) return []
            return [{
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [charger.longitude, charger.latitude]
            },
            properties: {
                name: charger.name,
                type: charger.charger_type_detailed,
                network: charger.network,
                address: charger.address,
                num_ports: ports,
                ev_connector_types: charger.ev_connector_types || [],
                charging_level: charger.charging_level,
                access_code: charger.access_code,
                max_power_kw: charger.max_power_kw
            }
        }]
        })

        const geojson: FeatureCollection = { type: 'FeatureCollection', features }

        if (map.getSource('charger-points')) {
            ;(
                map.getSource('charger-points') as mapboxgl.GeoJSONSource
            ).setData(geojson)
        } else {
            map.addSource('charger-points', {
                type: 'geojson',
                data: geojson
            })

            createChargerPointsLayer(map)
            if (mapsWithPointHandlers.has(map)) return
            mapsWithPointHandlers.add(map)

            // Hover-based Popup for Points
            let popup: mapboxgl.Popup | null = null
            
            map.on('mouseenter', 'charger-points', (e) => {
                if (!e.features || e.features.length === 0) return

                const props = e.features[0].properties
                if (!props) return

                // Remove existing popup
                if (popup) {
                    popup.remove()
                }

                // Helper function to format connector types
                const formatConnectorTypes = (connectorTypes: unknown) => {
                    if (!connectorTypes || !Array.isArray(connectorTypes)) return ''
                    
                    const typeColors: { [key: string]: string } = {
                        'TESLA': '#dc2626',
                        'J1772COMBO': '#f59e0b', 
                        'J1772': '#06b6d4',
                        'CHADEMO': '#8b5cf6'
                    }
                    
                    const typeNames: { [key: string]: string } = {
                        'TESLA': 'Tesla/NACS',
                        'J1772COMBO': 'CCS',
                        'J1772': 'J1772',
                        'CHADEMO': 'CHAdeMO'
                    }
                    
                    return connectorTypes.map(type => `
                        <span style="
                            font-size: 9px;
                            text-transform: uppercase; 
                            padding: 2px 6px; 
                            border-radius: 6px; 
                            background: ${typeColors[type] ? `${typeColors[type]}20` : 'rgba(255, 255, 255, 0.05)'};
                            color: ${typeColors[type] || 'rgba(255, 255, 255, 0.6)'};
                            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
                            font-weight: 500;
                            letter-spacing: 0.5px;
                            border: 1px solid ${typeColors[type] ? `${typeColors[type]}40` : 'rgba(255, 255, 255, 0.1)'};
                            white-space: nowrap;
                        ">
                            ${escapeHtml(typeNames[type] || type)}
                        </span>
                    `).join(' ')
                }

                // Create futuristic themed popup
                popup = new mapboxgl.Popup({
                    closeButton: false,
                    className: 'charger-station-popup',
                    offset: [0, -15]
                })
                    .addClassName('no-tip')
                    .setLngLat(e.lngLat)
                    .setHTML(
                        `
                        <div style="
                            background: rgba(9, 9, 11, 0.95); 
                            backdrop-filter: blur(16px);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            border-radius: 16px; 
                            padding: 16px; 
                            min-width: 320px;
                            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        ">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                <div style="
                                    width: 8px; 
                                    height: 8px; 
                                    border-radius: 50%; 
                                    background: ${props.type === 'dcfast' ? 'var(--neon-high)' : props.type === 'level2' ? 'var(--neon-mid)' : 'var(--neon-low)'}; 
                                    box-shadow: 0 0 12px ${props.type === 'dcfast' ? 'var(--neon-high)' : props.type === 'level2' ? 'var(--neon-mid)' : 'var(--neon-low)'};
                                    flex-shrink: 0;
                                "></div>
                                <h3 style="
                                    font-weight: 600; 
                                    font-size: 16px; 
                                    color: #ffffff; 
                                    margin: 0; 
                                    line-height: 1.3;
                                    flex: 1;
                                ">${escapeHtml(props.name)}</h3>
                            </div>
                            
                            <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                                <span style="
                                    font-size: 10px; 
                                    text-transform: uppercase; 
                                    padding: 4px 8px; 
                                    border-radius: 8px; 
                                    background: ${
                                        props.type === 'dcfast'
                                            ? 'rgba(16, 185, 129, 0.15)'
                                            : props.type === 'level2' 
                                            ? 'rgba(6, 182, 212, 0.15)'
                                            : 'rgba(139, 92, 246, 0.15)'
                                    }; 
                                    color: ${
                                        props.type === 'dcfast'
                                            ? 'var(--neon-high)'
                                            : props.type === 'level2'
                                            ? 'var(--neon-mid)'
                                            : 'var(--neon-low)'
                                    };
                                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
                                    font-weight: 500;
                                    letter-spacing: 0.5px;
                                    border: 1px solid ${
                                        props.type === 'dcfast'
                                            ? 'rgba(16, 185, 129, 0.3)'
                                            : props.type === 'level2' 
                                            ? 'rgba(6, 182, 212, 0.3)'
                                            : 'rgba(139, 92, 246, 0.3)'
                                    };
                                ">
                                    ${
                                        props.type === 'dcfast'
                                            ? 'DC FAST'
                                            : props.type === 'level2'
                                            ? 'LEVEL 2'
                                            : 'LEVEL 1'
                                    }
                                </span>
                                ${props.network ? `
                                <span style="
                                    font-size: 10px;
                                    text-transform: uppercase; 
                                    padding: 4px 8px; 
                                    border-radius: 8px; 
                                    background: rgba(255, 255, 255, 0.05);
                                    color: rgba(255, 255, 255, 0.6);
                                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
                                    font-weight: 400;
                                    letter-spacing: 0.5px;
                                    border: 1px solid rgba(255, 255, 255, 0.1);
                                ">
                                    ${escapeHtml(props.network)}
                                </span>` : ''}
                                ${props.num_ports > 1 ? `
                                <span style="
                                    font-size: 10px;
                                    text-transform: uppercase; 
                                    padding: 4px 8px; 
                                    border-radius: 8px; 
                                    background: rgba(99, 102, 241, 0.15);
                                    color: #6366f1;
                                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
                                    font-weight: 500;
                                    letter-spacing: 0.5px;
                                    border: 1px solid rgba(99, 102, 241, 0.3);
                                ">
                                    ${escapeHtml(props.num_ports)} Ports
                                </span>` : ''}
                                ${props.max_power_kw ? `
                                <span style="
                                    font-size: 10px;
                                    text-transform: uppercase; 
                                    padding: 4px 8px; 
                                    border-radius: 8px; 
                                    background: rgba(245, 158, 11, 0.15);
                                    color: #f59e0b;
                                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
                                    font-weight: 500;
                                    letter-spacing: 0.5px;
                                    border: 1px solid rgba(245, 158, 11, 0.3);
                                ">
                                    ${escapeHtml(props.max_power_kw)}kW
                                </span>` : ''}
                            </div>
                            
                            ${props.ev_connector_types && props.ev_connector_types.length > 0 ? `
                            <div style="margin-bottom: 12px;">
                                <div style="
                                    font-size: 9px; 
                                    color: rgba(255, 255, 255, 0.4); 
                                    text-transform: uppercase; 
                                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
                                    letter-spacing: 1px;
                                    margin-bottom: 6px;
                                    font-weight: 500;
                                ">
                                    Connector Types
                                </div>
                                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                    ${formatConnectorTypes(props.ev_connector_types)}
                                </div>
                            </div>` : ''}
                            
                            ${props.access_code && props.access_code !== 'public' ? `
                            <div style="margin-bottom: 12px;">
                                <span style="
                                    font-size: 9px;
                                    text-transform: uppercase; 
                                    padding: 3px 6px; 
                                    border-radius: 6px; 
                                    background: rgba(239, 68, 68, 0.15);
                                    color: #ef4444;
                                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
                                    font-weight: 500;
                                    letter-spacing: 0.5px;
                                    border: 1px solid rgba(239, 68, 68, 0.3);
                                ">
                                    ${props.access_code === 'private' ? 'Private Access' : escapeHtml(props.access_code)}
                                </span>
                            </div>` : ''}
                            
                            <div style="
                                border-top: 1px solid rgba(255, 255, 255, 0.1); 
                                padding-top: 12px;
                            ">
                                <p style="
                                    margin: 0; 
                                    font-size: 12px; 
                                    color: rgba(255, 255, 255, 0.7); 
                                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
                                    line-height: 1.4;
                                ">
                                    ${escapeHtml(props.address)}
                                </p>
                            </div>
                        </div>
                        `
                    )
                    .addTo(map)
            })

            map.on('mouseleave', 'charger-points', () => {
                if (popup) {
                    popup.remove()
                    popup = null
                }
            })

            map.on('mouseenter', 'charger-points', () => {
                map.getCanvas().style.cursor = 'pointer'
            })

            map.on('mouseleave', 'charger-points', () => {
                map.getCanvas().style.cursor = ''
            })
        }
    } catch (error) {
        if (request.controller.signal.aborted) return
        console.error('Error loading charger points:', error)
    }
}

export async function loadZipPolygons(
    map: mapboxgl.Map,
    filters: ScoreFilters,
    setupInteractions: (type: string) => void,
    onError?: (error: Error) => void
) {
    const request = beginLoad(regionLoads, map)
    try {
        console.log('Loading zip-level data with geometries from database...')

        const bounds = map.getBounds()
        if (!bounds) {
            throw new Error('Map bounds not available')
        }

        const zoom = Math.max(9, Math.round(map.getZoom()))

        const apiUrl =
            `/api/charging-data?zoom=${zoom}&` +
            `north=${bounds.getNorth()}&` +
            `south=${bounds.getSouth()}&` +
            `east=${bounds.getEast()}&` +
            `west=${bounds.getWest()}`

        const scoreData = await fetchMapData(apiUrl, request.controller.signal)

        if (!scoreData || !scoreData.data) {
            await loadCountyPolygons(map, filters, setupInteractions)
            return
        }

        if (scoreData.data.length === 0) return

        const filteredData = applyFiltersToData(scoreData.data, filters)

        const features: Feature[] = filteredData.flatMap((zip, index) => {
            if (!zip.geometry) return []
            return [{
                type: 'Feature', id: index, geometry: zip.geometry,
                properties: {
                    score: zip.score ?? null,
                    zip_code: zip.zip_code,
                    state: zip.state,
                    charger_count: zip.charger_count ?? 0,
                    filtered_charger_count: zip.filtered_charger_count ?? null,
                    population: zip.population ?? null,
                    model_message: zip.model_message,
                    traffic_message: zip.traffic_message,
                    capacity_message: zip.data_quality.message,
                    unknown_port_station_count: zip.data_quality.unknown_capacity_station_count ?? null
                }
            }]
        })

        if (features.length === 0) return

        const geojson: FeatureCollection = { type: 'FeatureCollection', features }

        if (regionLoads.get(map) !== request) return

        if (map.getSource('regions')) {
            ;(map.getSource('regions') as mapboxgl.GeoJSONSource).setData(
                geojson
            )
        } else {
            removeExistingLayers(map)

            map.addSource('regions', {
                type: 'geojson',
                data: geojson
            })

            createPolygonLayers(map)
            createTextLabels(map, Math.round(map.getZoom()))
            setupInteractions('polygon')
        }

        // APPLY THEME OVERRIDE
        applyThemeColors(map, filters.opportunityMode)
    } catch (error) {
        if (request.controller.signal.aborted) return
        console.error('❌ Failed to load zip polygons:', error)
        if (onError)
            onError(error instanceof Error ? error : new Error(String(error)))
    }
}
