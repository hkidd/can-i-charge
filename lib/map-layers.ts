import mapboxgl from 'mapbox-gl'

export function createPolygonLayers(map: mapboxgl.Map) {
    // Find the first label layer to insert our layers before it (keeps text on top)
    const layers = map.getStyle().layers
    let labelLayerId
    for (let i = 0; i < layers.length; i++) {
        if (
            layers[i].type === 'symbol' &&
            layers[i].layout &&
            (layers[i].layout as any)?.['text-field']
        ) {
            labelLayerId = layers[i].id
            break
        }
    }

    // 1. THE BASE FILL (Synthwave Spectrum)
    map.addLayer(
        {
            id: 'region-fills',
            type: 'fill',
            source: 'regions',
            paint: {
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'score'],
                    0,
                    '#2e1065', // Deep Violet (Low)
                    35,
                    '#4c1d95', // Lighter Violet
                    50,
                    '#2563eb', // Royal Blue (Mid)
                    75,
                    '#06b6d4', // Cyan
                    100,
                    '#10b981' // Neon Emerald (High)
                ],
                // Slight opacity boost for higher scores to make them "glow"
                'fill-opacity': [
                    'interpolate',
                    ['linear'],
                    ['get', 'score'],
                    0,
                    0.3, // Low scores blend into background more
                    100,
                    0.5 // High scores stand out
                ]
            }
        },
        labelLayerId
    )

    // 2. THE GRID LINES (High Contrast)
    map.addLayer(
        {
            id: 'region-borders',
            type: 'line',
            source: 'regions',
            paint: {
                'line-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'score'],
                    0,
                    '#7c3aed', // Bright Purple Edge
                    50,
                    '#38bdf8', // Bright Blue Edge
                    100,
                    '#34d399' // Bright Green Edge
                ],
                'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    4,
                    0.5,
                    10,
                    1.5
                ],
                'line-opacity': 0.5
            }
        },
        labelLayerId
    )

    // 3. HOVER HIGHLIGHT (Glowing Stroke)
    map.addLayer(
        {
            id: 'region-highlight',
            type: 'line',
            source: 'regions',
            paint: {
                'line-color': '#ffffff',
                'line-width': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    2,
                    0
                ],
                'line-opacity': 0.9,
                'line-blur': 1 // Adds a slight glow effect
            }
        },
        labelLayerId
    )

    // 4. HOVER FILL (Lighten the area)
    map.addLayer(
        {
            id: 'region-glow',
            type: 'fill',
            source: 'regions',
            paint: {
                'fill-color': '#ffffff',
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    0.1, // Adds a "glassy" white tint on hover
                    0
                ]
            }
        },
        labelLayerId
    )
}

export function createTextLabels(map: mapboxgl.Map, zoomLevel: number) {
    // Remove existing text labels if they exist
    if (map.getLayer('region-labels')) map.removeLayer('region-labels')
    if (map.getLayer('region-labels-halo'))
        map.removeLayer('region-labels-halo')

    // Determine what to show based on zoom level
    let textField: any = ''
    let minZoom = 0
    let maxZoom = 24

    if (zoomLevel <= 5) {
        textField = ['case', ['has', 'state_name'], ['get', 'state_name'], '']
        minZoom = 3
        maxZoom = 6
    } else if (zoomLevel <= 9) {
        textField = ['case', ['has', 'county_name'], ['get', 'county_name'], '']
        minZoom = 6
        maxZoom = 10
    } else if (zoomLevel >= 10) {
        textField = ['case', ['has', 'zip_code'], ['get', 'zip_code'], '']
        minZoom = 10
        maxZoom = 24
    }

    // Use a tech-oriented font stack
    const fontStack = ['DIN Offc Pro Medium', 'Arial Unicode MS Bold']

    // Add main text labels (Clean White Text)
    map.addLayer({
        id: 'region-labels',
        type: 'symbol',
        source: 'regions',
        minzoom: minZoom,
        maxzoom: maxZoom,
        layout: {
            'text-field': textField,
            'text-font': fontStack,
            'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                3,
                10,
                8,
                14,
                12,
                16
            ],
            'text-transform': 'uppercase',
            'text-letter-spacing': 0.1,
            'text-allow-overlap': false
        },
        paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#09090b', // Match map background
            'text-halo-width': 2,
            'text-opacity': 0.9
        }
    })
}

export function createChargerPointsLayer(map: mapboxgl.Map) {
    map.addLayer({
        id: 'charger-points',
        type: 'circle',
        source: 'charger-points',
        paint: {
            'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10,
                4,
                15,
                8
            ],
            'circle-color': [
                'match',
                ['get', 'type'],
                'dcfast',
                '#10b981', // Neon Green
                'level2',
                '#06b6d4', // Neon Cyan
                'level1',
                '#6366f1', // Neon Indigo
                '#9ca3af' // Grey default
            ],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#09090b', // Dark stroke to separate overlapping points
            'circle-stroke-opacity': 0.8,
            'circle-opacity': 0.9
        }
    })
}

export function removeExistingLayers(map: mapboxgl.Map) {
    const layersToRemove = [
        'region-labels',
        'region-labels-halo',
        'region-glow',
        'region-highlight',
        'region-borders',
        'region-fills',
        'charger-points'
    ]

    layersToRemove.forEach((layerId) => {
        if (map.getLayer(layerId)) {
            try {
                map.removeLayer(layerId)
            } catch (err) {}
        }
    })
    ;['regions', 'charger-points'].forEach((sourceId) => {
        if (map.getSource(sourceId)) {
            try {
                map.removeSource(sourceId)
            } catch (err) {}
        }
    })
}
