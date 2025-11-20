import mapboxgl from 'mapbox-gl'
import * as topojson from 'topojson-client'
import { supabaseAdmin } from './supabase'
import { applyFiltersToData, getStateCodeFromFIPS } from './map-utils'
import {
    createPolygonLayers,
    createChargerPointsLayer,
    createTextLabels,
    removeExistingLayers
} from './map-layers'

const applyThemeColors = (map: mapboxgl.Map, opportunityMode: boolean = false) => {
    if (map.getLayer('region-fills')) {
        if (opportunityMode) {
            // Opportunity mode: Gold/Orange/Red spectrum
            map.setPaintProperty('region-fills', 'fill-color', [
                'interpolate',
                ['linear'],
                ['get', 'score'],
                0,
                '#7f1d1d', // Dark Red
                35,
                '#dc2626', // Red
                50,
                '#ea580c', // Orange
                75,
                '#f59e0b', // Amber
                100,
                '#facc15' // Gold
            ])
        } else {
            // Normal mode: Purple to Green spectrum
            map.setPaintProperty('region-fills', 'fill-color', [
                'interpolate',
                ['linear'],
                ['get', 'score'],
                0,
                '#2e1065', // Deep Violet
                35,
                '#4c1d95', // Violet
                50,
                '#2563eb', // Blue
                75,
                '#06b6d4', // Cyan
                100,
                '#10b981' // Green
            ])
        }

        // Dynamic opacity: Better scores = Brighter glass
        map.setPaintProperty('region-fills', 'fill-opacity', [
            'interpolate',
            ['linear'],
            ['get', 'score'],
            0,
            0.3,
            100,
            0.5
        ])
    }

    if (map.getLayer('region-borders')) {
        if (opportunityMode) {
            // Opportunity mode borders
            map.setPaintProperty('region-borders', 'line-color', [
                'interpolate',
                ['linear'],
                ['get', 'score'],
                0,
                '#dc2626', // Red edge
                50,
                '#f59e0b', // Amber edge
                100,
                '#facc15' // Gold edge
            ])
        } else {
            // Normal mode borders
            map.setPaintProperty('region-borders', 'line-color', [
                'interpolate',
                ['linear'],
                ['get', 'score'],
                0,
                '#7c3aed', // Purple edge
                50,
                '#38bdf8', // Blue edge
                100,
                '#34d399' // Green edge
            ])
        }
        map.setPaintProperty('region-borders', 'line-opacity', 0.5)
    }
}

export async function loadStatePolygons(
    map: mapboxgl.Map,
    filters: any,
    setupInteractions: (type: string) => void,
    onError?: (error: Error) => void
) {
    try {
        const topoResponse = await fetch(
            'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'
        )
        const topology = await topoResponse.json()
        const statesGeo = topojson.feature(topology, topology.objects.states)

        const dataResponse = await fetch('/api/charging-data?zoom=4')
        const scoreData = await dataResponse.json()

        const filteredData = applyFiltersToData(scoreData.data, filters)
        const filteredScoreByName: Record<string, any> = {}
        filteredData.forEach((state: any) => {
            filteredScoreByName[state.state_name] = state
        })

        const features = (statesGeo as any).features.map((feature: any) => {
            const stateName = feature.properties.name
            const stateData = filteredScoreByName[stateName]

            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    score: stateData?.score || 0,
                    charger_count: stateData?.charger_count || 0,
                    filtered_charger_count:
                        stateData?.filtered_charger_count || 0,
                    population: stateData?.population || 0,
                    state_name: stateName
                }
            }
        })

        const geojson = { type: 'FeatureCollection', features }

        if (map.getSource('regions')) {
            ;(map.getSource('regions') as mapboxgl.GeoJSONSource).setData(
                geojson as any
            )
        } else {
            removeExistingLayers(map)

            map.addSource('regions', {
                type: 'geojson',
                data: geojson as any
            })

            createPolygonLayers(map)
            createTextLabels(map, 4)
            setupInteractions('polygon')
        }

        // APPLY THEME OVERRIDE
        applyThemeColors(map, filters.opportunityMode)
    } catch (error) {
        console.error('Failed to load state polygons:', error)
        if (onError)
            onError(error instanceof Error ? error : new Error(String(error)))
    }
}

export async function loadCountyPolygons(
    map: mapboxgl.Map,
    filters: any,
    setupInteractions: (type: string) => void,
    onError?: (error: Error) => void
) {
    try {
        const topoResponse = await fetch(
            'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
        )
        const topology = await topoResponse.json()
        const countiesGeo = topojson.feature(
            topology,
            topology.objects.counties
        )

        const bounds = map.getBounds()
        if (!bounds) {
            throw new Error('Map bounds not available')
        }

        const zoom = Math.round(map.getZoom())

        // Expand bounds significantly to load counties beyond immediate viewport
        const buffer = 5 // degrees - much larger buffer for smooth panning
        const expandedBounds = {
            north: bounds.getNorth() + buffer,
            south: bounds.getSouth() - buffer,
            east: bounds.getEast() + buffer,
            west: bounds.getWest() - buffer
        }

        const dataResponse = await fetch(
            `/api/charging-data?zoom=${zoom}&` +
                `north=${expandedBounds.north}&` +
                `south=${expandedBounds.south}&` +
                `east=${expandedBounds.east}&` +
                `west=${expandedBounds.west}`
        )

        const scoreData = await dataResponse.json()
        const filteredData = applyFiltersToData(scoreData.data, filters)

        const scoreByCounty: Record<string, any> = {}
        filteredData.forEach((county: any) => {
            const key = `${county.county_name}-${county.state}`
            scoreByCounty[key] = county
        })

        const features = (countiesGeo as any).features.map((feature: any) => {
            const countyName = feature.properties.name
            const stateId = feature.id.toString().substring(0, 2)
            const stateCode = getStateCodeFromFIPS(stateId)
            const key = `${countyName}-${stateCode}`
            const countyData = scoreByCounty[key]

            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    score: countyData?.score || 0,
                    charger_count: countyData?.charger_count || 0,
                    filtered_charger_count:
                        countyData?.filtered_charger_count || 0,
                    population: countyData?.population || 0,
                    county_name: countyName,
                    state: stateCode
                }
            }
        })

        const geojson = { type: 'FeatureCollection', features }

        if (map.getSource('regions')) {
            ;(map.getSource('regions') as mapboxgl.GeoJSONSource).setData(
                geojson as any
            )
        } else {
            removeExistingLayers(map)

            map.addSource('regions', {
                type: 'geojson',
                data: geojson as any
            })

            createPolygonLayers(map)
            createTextLabels(map, Math.round(map.getZoom()))
            setupInteractions('polygon')
        }

        // APPLY THEME OVERRIDE
        applyThemeColors(map, filters.opportunityMode)
    } catch (error) {
        console.error('Failed to load county polygons:', error)
        if (onError)
            onError(error instanceof Error ? error : new Error(String(error)))
    }
}

export async function loadChargerPoints(map: mapboxgl.Map, filters: any) {
    const bounds = map.getBounds()

    if (!bounds) {
        console.warn('Map bounds not available for charger points')
        return
    }

    try {
        // Build charger type filter
        const types = []
        if (filters.showDCFast) types.push('dcfast')
        if (filters.showLevel2) types.push('level2')
        if (filters.showLevel1) types.push('level1')

        if (types.length === 0) {
            if (map.getLayer('charger-points')) {
                map.removeLayer('charger-points')
            }
            if (map.getSource('charger-points')) {
                map.removeSource('charger-points')
            }
            return
        }

        // Base query with geographic bounds
        let query = supabaseAdmin
            .from('charging_stations')
            .select('*')
            .in('charger_type_detailed', types)
            .gte('latitude', bounds.getSouth())
            .lte('latitude', bounds.getNorth())
            .gte('longitude', bounds.getWest())
            .lte('longitude', bounds.getEast())
            .limit(500)

        // Apply connector type filtering if both aren't enabled
        if (filters.showTesla !== filters.showCCS) {
            if (filters.showTesla && !filters.showCCS) {
                // Only Tesla/NACS - look for TESLA connector type
                query = query.contains('ev_connector_types', ['TESLA'])
            } else if (filters.showCCS && !filters.showTesla) {
                // Only CCS/J1772/CHAdeMO - filter stations with these connector types
                // Use overlaps operator to check if array contains any of these values
                query = query.overlaps('ev_connector_types', ['J1772COMBO', 'J1772', 'CHADEMO'])
            }
        }
        // If both Tesla and CCS are enabled (or both disabled), show all stations

        const { data: chargers, error } = await query

        if (error) {
            console.error('Error fetching charger points:', error)
            return
        }

        const features = (chargers || []).map((charger) => ({
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
                num_ports: charger.num_ports || 1,
                ev_connector_types: charger.ev_connector_types || [],
                charging_level: charger.charging_level,
                access_code: charger.access_code,
                max_power_kw: charger.max_power_kw
            }
        }))

        const geojson = { type: 'FeatureCollection', features }

        if (map.getSource('charger-points')) {
            ;(
                map.getSource('charger-points') as mapboxgl.GeoJSONSource
            ).setData(geojson as any)
        } else {
            map.addSource('charger-points', {
                type: 'geojson',
                data: geojson as any
            })

            createChargerPointsLayer(map)

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
                const formatConnectorTypes = (connectorTypes: any) => {
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
                            ${typeNames[type] || type}
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
                                ">${props.name}</h3>
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
                                    ${props.network}
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
                                    ${props.num_ports} Ports
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
                                    ${props.max_power_kw}kW
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
                                    ${props.access_code === 'private' ? 'Private Access' : props.access_code}
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
                                    ${props.address}
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
        console.error('Error loading charger points:', error)
    }
}

export async function loadZipPolygons(
    map: mapboxgl.Map,
    filters: any,
    setupInteractions: (type: string) => void,
    onError?: (error: Error) => void
) {
    try {
        console.log('Loading zip-level data with geometries from database...')

        const bounds = map.getBounds()
        if (!bounds) {
            throw new Error('Map bounds not available')
        }

        const zoom = Math.round(map.getZoom())

        const apiUrl =
            `/api/charging-data?zoom=${zoom}&` +
            `north=${bounds.getNorth()}&` +
            `south=${bounds.getSouth()}&` +
            `east=${bounds.getEast()}&` +
            `west=${bounds.getWest()}`

        const dataResponse = await fetch(apiUrl)
        const scoreData = await dataResponse.json()

        if (!scoreData || !scoreData.data) {
            await loadCountyPolygons(map, filters, setupInteractions)
            return
        }

        if (scoreData.data.length === 0) return

        const filteredData = applyFiltersToData(scoreData.data, filters)

        const features = filteredData
            .filter((zip: any) => zip.geometry)
            .map((zip: any, index: number) => ({
                type: 'Feature',
                id: index,
                geometry: zip.geometry,
                properties: {
                    score: zip.score || 0,
                    zip_code: zip.zip_code,
                    state: zip.state,
                    charger_count: zip.charger_count || 0,
                    filtered_charger_count: zip.filtered_charger_count || 0,
                    population: zip.population || 0
                }
            }))

        if (features.length === 0) return

        const geojson = { type: 'FeatureCollection', features }

        if (map.getSource('regions')) {
            ;(map.getSource('regions') as mapboxgl.GeoJSONSource).setData(
                geojson as any
            )
        } else {
            removeExistingLayers(map)

            map.addSource('regions', {
                type: 'geojson',
                data: geojson as any
            })

            createPolygonLayers(map)
            createTextLabels(map, Math.round(map.getZoom()))
            setupInteractions('polygon')
        }

        // APPLY THEME OVERRIDE
        applyThemeColors(map, filters.opportunityMode)
    } catch (error) {
        console.error('❌ Failed to load zip polygons:', error)
        if (onError)
            onError(error instanceof Error ? error : new Error(String(error)))
        await loadCountyPolygons(map, filters, setupInteractions, onError)
    }
}
