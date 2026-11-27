import { expect, it, vi } from 'vitest'
import type mapboxgl from 'mapbox-gl'

const state = vi.hoisted(() => ({ html: '', from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { from: state.from } }))
vi.mock('@/lib/map-layers', () => ({
    createChargerPointsLayer: vi.fn(), createPolygonLayers: vi.fn(),
    createTextLabels: vi.fn(), removeExistingLayers: vi.fn()
}))
vi.mock('mapbox-gl', () => ({ default: { Popup: class {
    addClassName() { return this }
    setLngLat() { return this }
    setHTML(html: string) { state.html = html; return this }
    addTo() { return this }
    remove() { return this }
} } }))
import { loadChargerPoints } from '@/lib/map-data-loader'

it('treats station fields as text in map popups', async () => {
    const query = Promise.resolve({ data: [], error: null }) as unknown as Record<string, unknown>
    for (const method of ['select', 'eq', 'or', 'gte', 'lte', 'order', 'range', 'abortSignal']) query[method] = () => query
    state.from.mockReturnValue(query)
    const on = vi.fn()
    const map = {
        getBounds: () => ({ getSouth: () => 39, getNorth: () => 41, getWest: () => -106, getEast: () => -104 }),
        getSource: () => undefined, addSource: vi.fn(), on
    } as unknown as mapboxgl.Map
    await loadChargerPoints(map, { showDCFast: true, showLevel2: true, showLevel1: false, showTesla: true, showCCS: true })
    const hover = on.mock.calls.find(args => args[0] === 'mouseenter')![2]
    hover({ lngLat: { lng: -105, lat: 40 }, features: [{ properties: {
        name: '<b>Fixture station</b>', address: '<b>Fixture address</b>',
        network: 'A & B', type: 'dcfast', num_ports: 2, ev_connector_types: ['TESLA']
    } }] })
    expect(state.html).toContain('&lt;b&gt;Fixture station&lt;/b&gt;')
    expect(state.html).toContain('&lt;b&gt;Fixture address&lt;/b&gt;')
    expect(state.html).toContain('A &amp; B')
    expect(state.html).not.toContain('<b>Fixture')
})

it('requires speed and connector on the same charging unit and shows selected port counts', async () => {
    const { processNRELStation } = await import('@/lib/station-model')
    const mixed = processNRELStation({ id: 7, station_name: 'Mixed', latitude: 40, longitude: -105, state: 'CO',
        ev_connector_types: ['TESLA', 'J1772'], ev_dc_fast_num: 4, ev_level2_evse_num: 8,
        ev_charging_units: [{ charging_level: 'dc_fast', port_count: 4, connectors: { TESLA: { port_count: 4 } } },
            { charging_level: '2', port_count: 8, connectors: { J1772: { port_count: 8 } } }] })
    for (const [showDCFast, showLevel2, showTesla, showCCS, expected] of [
        [true, false, false, true, 0], [false, true, true, false, 0],
        [true, false, true, false, 4], [false, true, false, true, 8]
    ] as const) {
        let page = 0
        const query = { then: (resolve: (value: unknown) => void) => Promise.resolve({ data: page++ === 0 ? [mixed] : [], error: null }).then(resolve) } as unknown as Record<string, unknown>
        for (const method of ['select', 'eq', 'or', 'gte', 'lte', 'order', 'range', 'abortSignal', 'overlaps']) query[method] = () => query
        state.from.mockReturnValue(query)
        const addSource = vi.fn()
        const map = { getBounds: () => ({ getSouth: () => 39, getNorth: () => 41, getWest: () => -106, getEast: () => -104 }),
            getSource: () => undefined, addSource, on: vi.fn() } as unknown as mapboxgl.Map
        await loadChargerPoints(map, { showDCFast, showLevel2, showTesla, showCCS, showLevel1: false })
        const features = addSource.mock.calls[0][1].data.features
        expect(features).toHaveLength(expected ? 1 : 0)
        if (expected) expect(features[0].properties.num_ports).toBe(expected)
    }
})

it('does not restore stale charging points after filters are switched off',async()=>{
    let resolve!: (data: {data: never[];error:null})=>void
    const query=new Promise(done=>{resolve=done}) as unknown as Record<string,unknown>
    for(const method of ['select','eq','or','gte','lte','order','range','abortSignal'])query[method]=()=>query
    state.from.mockReturnValue(query)
    const addSource=vi.fn()
    const map={getBounds:()=>({getSouth:()=>39,getNorth:()=>41,getWest:()=>-106,getEast:()=>-104}),getSource:()=>undefined,getLayer:()=>undefined,addSource,on:vi.fn()} as unknown as mapboxgl.Map
    const filters={showDCFast:true,showLevel2:true,showLevel1:true,showTesla:true,showCCS:true}
    const old=loadChargerPoints(map,filters)
    await loadChargerPoints(map,{...filters,showDCFast:false,showLevel2:false,showLevel1:false})
    resolve({data:[],error:null});await old
    expect(addSource).not.toHaveBeenCalled()
})
