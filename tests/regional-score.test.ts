import {describe,expect,it} from 'vitest'
import {calculateRegionalScore,DEFAULT_SCORE_FILTERS,getScoreDataQuality} from '@/lib/regional-score'
import {applyFiltersToData} from '@/lib/map-utils'
import {scoreFixture} from './fixtures/demand'

describe('absolute fleet/provision readiness',()=>{
 it('defines 100 as meeting both targets and keeps component totals exact',()=>{
  const result=calculateRegionalScore(scoreFixture())
  expect(result.score).toBe(100)
  expect(result.breakdown).toEqual({nearby_chargers:85,fast_charging:15,network_diversity:0,charging_density:0})
  expect(result.evidence).toMatchObject({estimated_plugin_vehicles:3300,target_level2_ports:100,target_fast_ports:18.2})
 })
 it('does not let excess fast charging compensate for a Level 2 shortage',()=>{
  expect(calculateRegionalScore(scoreFixture(50,10000)).score).toBe(58)
  expect(calculateRegionalScore(scoreFixture(10000,0)).score).toBe(85)
  expect(calculateRegionalScore(scoreFixture(0,0)).score).toBe(0)
 })
 it('decreases provision when EV demand grows and ignores peer scores',()=>{
  const base=scoreFixture(50,10);const bigger={...base,demand_data:{...base.demand_data,bev:5940,phev:660}}
  expect(calculateRegionalScore(bigger).score).toBeLessThan(calculateRegionalScore(base).score!)
  for(const multiplier of [.1,.5,1,2,10]){
   const input=scoreFixture(100*multiplier,19*multiplier);const r=calculateRegionalScore(input)
   expect(r.score).toBeGreaterThanOrEqual(0);expect(r.score).toBeLessThanOrEqual(100)
   expect(Object.values(r.breakdown!).reduce((a,b)=>a+b,0)).toBe(r.score)
  }
 })
 it('allocates local fleet estimates from Census population and labels the estimate',()=>{
  const input=scoreFixture(50,10);input.population=5000;input.demand_data.allocation='population_estimate'
  expect(calculateRegionalScore(input).evidence).toMatchObject({estimated_plugin_vehicles:1650,fleet_basis:'population_estimate'})
 })
 it('keeps scores independent of whether the count display shows sites or ports',()=>{
  const input=scoreFixture(50,10)
  expect(applyFiltersToData([input],{...DEFAULT_SCORE_FILTERS,usePortWeighting:false})[0].score).toBe(calculateRegionalScore(input).score)
 })
 it('uses the same model with an explicit future fleet for the 2030 gap',()=>{
  const input=scoreFixture();const future=calculateRegionalScore(input,10000,{...DEFAULT_SCORE_FILTERS,opportunityMode:true})
  expect(future.score).toBeGreaterThan(0)
  expect(future.evidence!.scenario_plugin_vehicles).toBeGreaterThan(future.evidence!.estimated_plugin_vehicles)
  expect(future.evidence!.horizon).toBe('2030_scenario')
  expect(future.score).toBe(100-Object.values(future.breakdown!).reduce((a,b)=>a+b,0))
 })
 it('keeps missing fleet or population unrated rather than inventing demand',()=>{
  expect(calculateRegionalScore({...scoreFixture(),demand_data:null}).score).toBeNull()
  for(const pop of [null,0,-1,NaN,Infinity])expect(calculateRegionalScore(scoreFixture(),pop).score).toBeNull()
 })
 it('retains the 95% reporting gate and never imputes missing ports',()=>{
  const input=scoreFixture();input.public_supply.all.unknown_port_station_count=1
  expect(calculateRegionalScore(input).score).toBe(100)
  expect(getScoreDataQuality(input.public_supply.all)).toMatchObject({capacity_reporting:'partial',reported_capacity_station_count:19})
  input.public_supply.all.unknown_port_station_count=2
  expect(calculateRegionalScore(input).score).toBeNull()
 })
 it('does not credit Level 1 ports or restricted sites toward the modeled targets',()=>{
  const input=scoreFixture(0,0);input.public_supply.all.level1_ports=10000;input.public_supply.restricted_stations=100
  const result=calculateRegionalScore(input)
  expect(result.score).toBe(0);expect(result.evidence?.excluded_restricted_stations).toBe(100)
 })
})
