import {describe,expect,it} from 'vitest'
import {processNRELStation} from '@/lib/station-model'
import {addStation,emptySummary} from '@/lib/region-aggregation'
import {applyFiltersToData} from '@/lib/map-utils'
import {demandFixture} from './fixtures/demand'
import {DEFAULT_SCORE_FILTERS} from '@/lib/regional-score'
import {stationCapacity,selectedSiteCount} from '@/lib/station-filters'

const mixed=processNRELStation({id:1,station_name:'Mixed',latitude:40,longitude:-105,state:'CO',restricted_access:false,ev_connector_types:['TESLA','J1772'],ev_dc_fast_num:4,ev_level2_evse_num:8,
 ev_charging_units:[{charging_level:'dc_fast',port_count:4,connectors:{TESLA:{port_count:4}}},{charging_level:'2',port_count:8,connectors:{J1772:{port_count:8}}}]})
const other=processNRELStation({id:2,station_name:'Other',latitude:40,longitude:-105,state:'CO',restricted_access:false,ev_connector_types:['J1772COMBO','J1772'],ev_dc_fast_num:2,ev_level2_evse_num:3,
 ev_charging_units:[{charging_level:'dc_fast',port_count:2,connectors:{J1772COMBO:{port_count:2}}},{charging_level:'2',port_count:3,connectors:{J1772:{port_count:3}}}]})
const summary={...emptySummary(),population:10000,demand_data:demandFixture};addStation(summary,mixed);addStation(summary,other)

describe('measured connector and speed filters',()=>{
 it('counts only compatible charging units instead of borrowing a site-wide speed ratio',()=>{
  expect(stationCapacity(mixed,'tesla').ports).toEqual({level1:0,level2:0,dcfast:4})
  const [tesla]=applyFiltersToData([summary],{...DEFAULT_SCORE_FILTERS,showCCS:false})
  const [nonTesla]=applyFiltersToData([summary],{...DEFAULT_SCORE_FILTERS,showTesla:false})
  expect(tesla.filtered_charger_count).toBe(4);expect(nonTesla.filtered_charger_count).toBe(13)
  expect(tesla.score).not.toBeNull();expect(nonTesla.score).not.toBeNull()
  expect(applyFiltersToData([summary],{...DEFAULT_SCORE_FILTERS,showCCS:false,showDCFast:false})[0].filtered_charger_count).toBe(0)
 })
 it('counts mixed-speed sites once for every speed combination',()=>{
  expect(applyFiltersToData([summary],{...DEFAULT_SCORE_FILTERS,usePortWeighting:false,showLevel1:false})[0].filtered_charger_count).toBe(2)
  expect(selectedSiteCount(summary.filter_summary.all,6)).toBe(2)
 })
 it('keeps every connector/speed/weight/mode combination numeric with known data',()=>{
  for(let connectors=0;connectors<4;connectors++)for(let speeds=0;speeds<8;speeds++)for(const usePortWeighting of [false,true])for(const opportunityMode of [false,true]){
   const filters={...DEFAULT_SCORE_FILTERS,showTesla:!!(connectors&1),showCCS:!!(connectors&2),showLevel1:!!(speeds&1),showLevel2:!!(speeds&2),showDCFast:!!(speeds&4),usePortWeighting,opportunityMode}
   const result=applyFiltersToData([summary],filters)[0]
   expect(result.score).not.toBeNull();expect(result.score).toBeGreaterThanOrEqual(0);expect(result.score).toBeLessThanOrEqual(100)
   expect(result.filtered_charger_count).not.toBeNull()
   if(!connectors||!speeds){expect(result.score).toBe(0);expect(result.filtered_charger_count).toBe(0)}
  }
 })
 it('uses selected connector capacity in Opportunity Mode',()=>{
  const all=applyFiltersToData([summary],{...DEFAULT_SCORE_FILTERS,opportunityMode:true})[0]
  const tesla=applyFiltersToData([summary],{...DEFAULT_SCORE_FILTERS,showCCS:false,opportunityMode:true})[0]
  expect(tesla.score).toBeGreaterThanOrEqual(all.score!)
 })
 it('does not allocate ambiguous mixed sites or double-count shared connector ports',()=>{
  const unknown={...mixed,charging_units_complete:false}
  expect(stationCapacity(unknown,'tesla')).toMatchObject({known:false})
  const shared={...mixed,charging_units:[{level:'dcfast' as const,ports:4,connectors:{TESLA:4,NACS:4}}]}
  expect(stationCapacity(shared,'tesla').ports.dcfast).toBe(4)
  const ambiguous={...shared,charging_units:[{level:'dcfast' as const,ports:4,connectors:{TESLA:2,NACS:2}}]}
  expect(stationCapacity(ambiguous,'tesla').known).toBe(false)
 })
 it('keeps coverage metadata specific to the selected connector family',()=>{
  const partial={...emptySummary(),population:10000,demand_data:demandFixture}
  for(let i=0;i<24;i++)addStation(partial,mixed)
  addStation(partial,{...mixed,charging_units_complete:false})
  const result=applyFiltersToData([partial],{...DEFAULT_SCORE_FILTERS,showCCS:false})[0]
  expect(result.score).not.toBeNull();expect(result.data_quality).toMatchObject({station_count:25,unknown_capacity_station_count:1,capacity_reporting:'partial'})
 })
})
