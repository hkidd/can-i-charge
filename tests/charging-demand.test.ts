import {expect,it} from 'vitest'
import {demandTargets} from '@/lib/charging-demand'
import {demandFixture,scoreFixture} from './fixtures/demand'
import {calculateRegionalScore,DEFAULT_SCORE_FILTERS} from '@/lib/regional-score'
import {emptyPublicSupply,addPublicStation} from '@/lib/station-filters'
import {processNRELStation} from '@/lib/station-model'
import registrations from '../data/ev-registrations-2025.json'

it('reconciles the pinned state fleet to the national registration total',()=>{
 expect(registrations.states).toHaveLength(51)
 expect(new Set(registrations.states.map(s=>s.state_name)).size).toBe(51)
 expect(registrations.states.reduce((n,s)=>n+s.bev+s.phev,0)).toBe(registrations.national_plugin_count)
 expect(registrations.national_plugin_count).toBe(7454800)
})
it('allocates local fleet estimates consistently without claiming local registrations',()=>{
 const data={...demandFixture,allocation:'population_estimate' as const}
 const left=demandTargets(data,3000,null,false)!,right=demandTargets(data,7000,null,false)!
 expect(left.fleet+right.fleet).toBe(3300)
 expect(left.level2+right.level2).toBeCloseTo(100)
})
it('uses BEVs for fast demand and all plug-ins for the destination target',()=>{
 const a=demandTargets(demandFixture,10000,null,false)!
 const b=demandTargets({...demandFixture,bev:1650,phev:1650},10000,null,false)!
 expect(a.level2).toBe(b.level2);expect(a.fast).toBeGreaterThan(b.fast)
})
it('labels state traffic as a proxy and bounds outlier road intensity',()=>{
 const data={...demandFixture,state_road_miles_per_capita:100,national_road_miles_per_capita:25}
 expect(demandTargets(data,10000,null,false)).toMatchObject({multiplier:2,trafficBasis:'state_2023_proxy'})
 const traffic={source:'fixture',year:2023,annual_vmt:365*10000*5,retrieved_at:'2026-11-25',scope:'county' as const,county_count:1,expected_county_count:1}
 expect(demandTargets(data,10000,traffic,false)).toMatchObject({multiplier:.5,trafficBasis:'regional_2023'})
})
it('excludes restricted and unknown-access supply instead of applying an invented discount',()=>{
 const supply=emptyPublicSupply()
 const station=processNRELStation({id:1,station_name:'Fixture',latitude:40,longitude:-105,state:'CO',ev_level2_evse_num:10,ev_connector_types:['J1772'],restricted_access:false})
 for(const restriction of [false,true,null])addPublicStation(supply,{...station,restricted_access:restriction})
 expect(supply.all.level2_ports).toBe(10);expect(supply.all.charger_count).toBe(1)
 expect(supply.restricted_stations).toBe(1);expect(supply.unknown_access_stations).toBe(1)
})
it('holds the regional fleet target constant under connector filtering and reduces supply only',()=>{
 const input=scoreFixture();input.public_supply.tesla.level2_ports=10
 const all=calculateRegionalScore(input),selected=calculateRegionalScore(input,10000,{...DEFAULT_SCORE_FILTERS,showCCS:false})
 expect(selected.evidence?.target_level2_ports).toBe(all.evidence?.target_level2_ports)
 expect(selected.score).toBeLessThan(all.score!)
})
it('never changes a score merely because a site adds a new connector family',()=>{
 const input=scoreFixture(50,10);const before=calculateRegionalScore(input).score
 input.public_supply.all.tesla_count=200;input.public_supply.all.ccs_count=300
 expect(calculateRegionalScore(input).score).toBe(before)
})
