import { expect, it } from 'vitest'
import { CountyIndex, polygonContains, getCountyIndex } from '@/lib/region-geography'
import { addStation, buildRegionalSnapshot, emptySummary } from '@/lib/region-aggregation'
import { processNRELStation } from '@/lib/station-model'
const west = [[[-106,39],[-105,39],[-105,41],[-106,41],[-106,39]]]
const east = [[[-105,39],[-104,39],[-104,41],[-105,41],[-105,39]]]
const index = new CountyIndex([
    { fips: '08001', name: 'West', state: 'CO', lat: 40, lng: -105.5, polygons: [west] },
    { fips: '08003', name: 'East', state: 'CO', lat: 40, lng: -104.5, polygons: [east] }
])
const station = processNRELStation({ id: 1, station_name: 'Fixture', latitude: 40, longitude: -105.5, state: 'CO', zip: '80000', ev_dc_fast_num: 2, ev_level2_evse_num: 10, ev_connector_types: ['TESLA', 'J1772COMBO'] })
it('uses polygon boundaries and holes rather than overlapping bounding boxes', () => {
    const triangle = [[[0,0],[2,0],[0,2],[0,0]]]
    expect(polygonContains(triangle, 1.8, 1.8)).toBe(false)
    expect(polygonContains([...west, [[-105.8,39.5],[-105.2,39.5],[-105.2,40.5],[-105.8,40.5],[-105.8,39.5]]], -105.5, 40)).toBe(false)
    expect(index.locate('CO', -105, 40)?.fips).toBe('08001')
    expect(index.locate('WY', -105, 40)).toBeUndefined()
})
it('counts mixed sites once overall while preserving every speed and total port', () => {
    const summary = emptySummary()
    addStation(summary, station)
    expect(summary.charger_count).toBe(1)
    expect([summary.dcfast_count, summary.level2_count]).toEqual([1, 1])
    expect([summary.dcfast_ports, summary.level2_ports, summary.total_ports]).toEqual([2, 10, 12])
    expect(summary.connector_ports_complete).toBe(false)
    expect([summary.tesla_ports, summary.ccs_ports]).toEqual([0, 0])
})
it('preserves zero-charger ZIPs, assigns each site to one county, and labels population provenance', () => {
    const people = { states: new Map([['08', 5000000]]), counties: new Map([['08001', 10000]]), zips: new Map<string,number>(), source: 'census_fixture', failures: ['zips'] }
    const result = buildRegionalSnapshot([station], people, {
        states: [], counties: [], zips: [
            { zip_code: '80000', state: 'CO', population: 10000, center_lat: 40, center_lng: -105.5 },
            { zip_code: '80001', state: 'CO', population: 12000, center_lat: 40, center_lng: -104.5 }
        ]
    }, index, '2026-11-23T00:00:00Z')
    expect(result.states.find(row => row.state_name === 'Colorado')?.charger_count).toBe(1)
    expect(result.counties.map(row => row.charger_count)).toEqual([1, 0])
    expect(result.zips.find(row => row.zip_code === '80001')?.charger_count).toBe(0)
    expect(result.zips.find(row => row.zip_code === '80000')?.population_source).toBe('previous_unverified')
    expect(result.diagnostics.unassigned_county_stations).toBe(0)
    expect(result.counties.find(row => row.county_fips === '08003')?.ev_infrastructure_score).toBeNull()
})

it('resolves representative mainland, Alaska, Hawaii and DC sites against the bundled boundaries', () => {
    const real = getCountyIndex()
    expect(real.locate('CO', -104.99, 39.739)?.fips).toBe('08031')
    expect(real.locate('AK', -149.9003, 61.2181)?.fips).toBe('02020')
    expect(real.locate('HI', -157.8582, 21.3099)?.fips).toBe('15003')
    expect(real.locate('DC', -77.0369, 38.9072)?.fips).toBe('11001')
})
it('handles a national-size fixture in one aggregation pass without losing stations', () => {
    const locations = [
        { state: 'CO', latitude: 39.739, longitude: -104.99 },
        { state: 'CA', latitude: 34.0522, longitude: -118.2437 },
        { state: 'NY', latitude: 40.7128, longitude: -74.006 },
        { state: 'HI', latitude: 21.3099, longitude: -157.8582 },
        { state: 'DC', latitude: 38.9072, longitude: -77.0369 }
    ]
    const records = Array.from({ length: 100000 }, (_, i) => ({ ...station, ...locations[i % locations.length], id: `fixture-${i}`, source_id: i + 1, zip: String(10000 + i % 20000) }))
    const start = performance.now()
    const result = buildRegionalSnapshot(records, { states: new Map(), counties: new Map(), zips: new Map(), source: 'fixture', failures: [] }, { states: [], counties: [], zips: [] })
    expect(result.states.reduce((n, row) => n + row.charger_count, 0)).toBe(100000)
    expect(result.counties.reduce((n, row) => n + row.charger_count, 0)).toBe(100000)
    expect(result.zips.reduce((n, row) => n + row.charger_count, 0)).toBe(100000)
    expect(result.zips).toHaveLength(20000)
    console.info(`Synthetic aggregation: 100000 stations, 20000 ZIPs, ${Math.round(performance.now() - start)}ms CPU time`)
})

it('retains traffic provenance through refresh and recomputes per-capita values against the refreshed population',()=>{
    const traffic={source:'fixture',year:2023,annual_vmt:365000000,retrieved_at:'2026-11-25',scope:'county' as const,county_count:1,expected_county_count:1}
    const people={states:new Map([['08',5000000]]),counties:new Map([['08001',20000]]),zips:new Map<string,number>(),source:'census_fixture',failures:[]}
    const result=buildRegionalSnapshot([station],people,{states:[{state_name:'Colorado',traffic_data:{...traffic,scope:'state'}}],counties:[{county_fips:'08001',traffic_data:traffic,vmt_per_capita:999}],zips:[]},index)
    expect(result.states.find(r=>r.state_name==='Colorado')?.traffic_data).toMatchObject({source:'fixture',year:2023,scope:'state'})
    expect(result.counties.find(r=>r.county_fips==='08001')).toMatchObject({traffic_data:traffic,daily_vmt:1000000,vmt_per_capita:50})
    expect(result.zips[0].traffic_data).toBeNull()
})

it('resolves legacy US ZIP placeholders from boundaries before assigning state fleet estimates',()=>{
    const people={states:new Map([['08',5000000]]),counties:new Map<string,number>(),zips:new Map([['80001',1000]]),source:'fixture',failures:[]}
    const result=buildRegionalSnapshot([],people,{states:[],counties:[],zips:[{zip_code:'80001',state:'US',center_lat:40,center_lng:-104.5}]},index)
    expect(result.zips[0].state).toBe('CO')
    expect(result.zips[0].demand_data?.state_code).toBe('CO')
    expect(result.zips[0].ev_infrastructure_score).toBe(0)
})
