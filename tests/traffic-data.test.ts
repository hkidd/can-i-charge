import {expect,it} from 'vitest'
import {annualToDaily,csvFields,parseAnnualTraffic,trafficPerCapita} from '@/lib/traffic-data'
const header='# country_cd,region_cd,tribal_code,census_tract_cd,shape_id,scc,act_parm_type_cd,act_parm_uofmsr,activity_type,ann_parm_value,calc_year,date_updated,data_set_id,jan_value,feb_value,mar_value,apr_value,may_value,jun_value,jul_value,aug_value,sep_value,oct_value,nov_value,dec_value,comment'
const row=(fips='06037',scc='2201110200',annual='365000',year='2023')=>`"US","${fips}",,,,"${scc}",,,"VMT",${annual},${year},"20250611",,0,0,0,0,0,0,0,0,0,0,0,0,"county, source"`
async function* lines(rows:string[]){yield header;yield* rows}
it('aggregates source categories by exact FIPS and converts annual miles once',async()=>{
 const data=await parseAnnualTraffic(lines([row(),row('06037','2201110300'),row('08031')]))
 expect(data.counties.get('06037')).toBe(730000);expect(data.rows).toBe(3)
 expect(annualToDaily(730000,2023)).toBe(2000);expect(annualToDaily(366000,2024)).toBe(1000)
 expect(csvFields('"A, B","quoted ""value""",3')).toEqual(['A, B','quoted "value"','3'])
})
it('rejects duplicates, wrong units/schema/year, and invalid values instead of publishing partial data',async()=>{
 for(const rows of [[row(),row()],[row('06037','2201110200','-1')],[row('06037','2201110200','1','2022')],[row().replace('"VMT"','"POP"')]])await expect(parseAnnualTraffic(lines(rows))).rejects.toThrow()
 await expect(parseAnnualTraffic(lines([]))).rejects.toThrow('Empty')
})
it('does not turn missing populations or incomplete state coverage into measured demand',()=>{
 const traffic={source:'fixture',year:2023,annual_vmt:365000,retrieved_at:'2026-11-25',scope:'state' as const,county_count:1,expected_county_count:2}
 expect(trafficPerCapita(traffic,1000)).toBeNull()
 expect(trafficPerCapita({...traffic,county_count:2},1000)).toBe(1)
 expect(trafficPerCapita(traffic,0)).toBeNull()
})

it('combines the documented Alaska successor areas without name matching or population allocation', async()=>{
 const {trafficForCounty}=await import('@/lib/traffic-data')
 expect(trafficForCounty(new Map([['02063',20],['02066',30]]),'02261')).toBe(50)
 expect(trafficForCounty(new Map([['02063',20]]),'02261')).toBeUndefined()
})
