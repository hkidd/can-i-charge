import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import type mapboxgl from 'mapbox-gl'
import type * as StyleSpec from 'mapbox-gl/dist/style-spec/index.d.ts'
import { createPolygonLayers } from '@/lib/map-layers'

const { Color, expression, latest } = createRequire(import.meta.url)(
    'mapbox-gl/dist/style-spec/index.cjs'
) as typeof StyleSpec

it('renders unavailable region scores in neutral gray, distinct from a real zero', () => {
    const layers: mapboxgl.LayerSpecification[] = []
    const map = {
        getStyle: () => ({ layers: [] }),
        addLayer: (layer: mapboxgl.LayerSpecification) => layers.push(layer)
    } as unknown as mapboxgl.Map
    createPolygonLayers(map)
    const fills = layers.find(layer => layer.type === 'fill') as mapboxgl.FillLayerSpecification
    const result = expression.createExpression(fills.paint!['fill-color'], latest.paint_fill['fill-color'])
    expect(result.result).toBe('success')
    if (result.result !== 'success') throw new Error('Invalid fill expression')
    const unrated = result.value.evaluate({ zoom: 4 }, { type: 3, properties: { score: null } })
    const zero = result.value.evaluate({ zoom: 4 }, { type: 3, properties: { score: 0 } })
    expect(unrated).toEqual(Color.parse('#64748b'))
    expect(unrated).not.toEqual(zero)
})
