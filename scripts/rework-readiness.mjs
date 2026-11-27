import {config} from 'dotenv'
import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {createServer} from 'vite'

process.umask(0o077)
config({path:'.env.local',quiet:true})
const connection = new URL(process.env.DATABASE_URL)
if (!['postgres:','postgresql:'].includes(connection.protocol) || !decodeURIComponent(connection.username).includes('lwymugddoqggxkvilodu') || !connection.hostname.endsWith('.supabase.com')) throw Error('Expected production Session pooler URI')
const password=decodeURIComponent(connection.password)
const env={...process.env,PGHOST:connection.hostname,PGPORT:connection.port||'5432',PGUSER:decodeURIComponent(connection.username),PGPASSWORD:password,PGDATABASE:connection.pathname.slice(1),PGSSLMODE:'require',PGCONNECT_TIMEOUT:'20'}
const run=sql=>{
 const result=spawnSync('/opt/homebrew/opt/postgresql@18/bin/psql',['-X','-q','-v','ON_ERROR_STOP=1','-At'],{input:sql,env,encoding:'utf8',maxBuffer:512*1024*1024})
 if(result.status!==0)throw Error((result.stderr||'Database command failed').replaceAll(password,'[redacted]'))
 return result.stdout.trim()
}
if(process.argv.includes('--apply')){run(readFileSync('.vercel/model/publish.sql','utf8'));console.log('Readiness model published atomically.');process.exit(0)}
// A single read-only transaction captures station and regional data from the same publication.
const source={stations:[],states:[],counties:[],zips:[]}
mkdirSync('.vercel/model',{recursive:true})
const rows=process.argv.includes('--cached') ? readFileSync('.vercel/model/source.jsonl','utf8') : run(`begin isolation level repeatable read read only;
select json_build_object('kind','run','data',id) from public.station_refresh_runs where status='published' order by completed_at desc limit 1;
select json_build_object('kind','stations','data',s) from public.charging_stations s;
select json_build_object('kind','states','data',s) from public.state_level_data s;
select json_build_object('kind','counties','data',s) from public.county_level_data s;
select json_build_object('kind','zips','data',s) from public.zip_level_data s;
commit;`)
writeFileSync('.vercel/model/source.jsonl',rows,{mode:0o600})
for(const line of rows.split('\n')){const row=JSON.parse(line);if(row.kind==='run')source.run=row.data;else source[row.kind].push(row.data)}
console.log(JSON.stringify({read_snapshot:source.run,stations:source.stations.length}))

const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'})
try{
 const {buildRegionalSnapshot}=await server.ssrLoadModule('/lib/region-aggregation.ts')
 const {applyFiltersToData}=await server.ssrLoadModule('/lib/map-utils.ts')
 const snapshot=buildRegionalSnapshot(source.stations,{states:new Map(),counties:new Map(),zips:new Map(),source:'retained',failures:[]},{states:source.states,counties:source.counties,zips:source.zips})
 const definitions=[['state_level_data','state_name','states'],['county_level_data','county_fips','counties'],['zip_level_data','zip_code','zips']]
 let sql=`begin;\nset local lock_timeout='5s';\nset local statement_timeout='120s';\nselect pg_advisory_xact_lock(78391142);\ndo $$ begin if exists(select 1 from public.station_refresh_runs where status in ('fetching','staged','aggregating','ready')) or (select id::text from public.station_refresh_runs where status='published' order by completed_at desc limit 1) <> '${source.run}' then raise exception 'Snapshot changed or refresh active; rebuild the backfill'; end if; end $$;\n`
 for(const [table,key,field] of definitions){
  const existing=new Map(source[field].map(row=>[row[key],row]))
  const updates=snapshot[field].map(row=>{
   const old=existing.get(row[key]);if(!old||old.charger_count!==row.charger_count||old.total_ports!==row.total_ports)throw Error(`Snapshot mismatch: ${table} ${row[key]}`)
   return {key:row[key],public_supply:row.public_supply,demand_data:row.demand_data,ev_infrastructure_score:row.ev_infrastructure_score,scoring_version:row.scoring_version,state:row.state}
  })
  if(updates.length!==existing.size)throw Error(`Region count mismatch: ${table}`)
  for(const target of [table,table+'_staging'])for(let offset=0;offset<updates.length;offset+=250){
   const json=JSON.stringify(updates.slice(offset,offset+250)).replaceAll("'","''")
   const stateAssignment = table === 'zip_level_data' ? ',state=u.state' : ''
   sql+=`update public.${target} t set public_supply=u.public_supply,demand_data=u.demand_data,ev_infrastructure_score=u.ev_infrastructure_score,scoring_version=u.scoring_version${stateAssignment} from jsonb_to_recordset('${json}'::jsonb) as u(key text,public_supply jsonb,demand_data jsonb,ev_infrastructure_score integer,scoring_version text,state text) where t.${key}=u.key;\n`
  }
 }
 sql+='commit;\n'
 mkdirSync('.vercel/model',{recursive:true})
 writeFileSync('.vercel/model/publish.sql',sql,{mode:0o600})
 const filters={showDCFast:true,showLevel2:true,showLevel1:true,showTesla:true,showCCS:true,usePortWeighting:true}
 const report={run:source.run,stations:source.stations.length,regions:Object.fromEntries(definitions.map(([, , field])=>[field,snapshot[field].length])),
  levels:Object.fromEntries(definitions.map(([,key,field])=>{const old=new Map(source[field].map(r=>[r[key],r]));const rated=snapshot[field].filter(r=>r.ev_infrastructure_score!==null);const reasons={};for(const row of snapshot[field].filter(r=>r.ev_infrastructure_score===null)){const reason=!row.population?'population_missing':!row.demand_data?'state_fleet_missing':'capacity_reporting_insufficient';reasons[reason]=(reasons[reason]??0)+1;}return[field,{unrated_reasons:reasons,rated:rated.length,unrated:snapshot[field].length-rated.length,min:Math.min(...rated.map(r=>r.ev_infrastructure_score)),max:Math.max(...rated.map(r=>r.ev_infrastructure_score)),median:rated.map(r=>r.ev_infrastructure_score).sort((a,b)=>a-b)[Math.floor(rated.length/2)],examples:snapshot[field].filter(r=>field==='states'||['94590','80202','02108','96813','99501','Solano'].includes(r[key])).map(r=>({region:r[key],old:old.get(r[key])?.ev_infrastructure_score,current:r.ev_infrastructure_score,model:applyFiltersToData([r],filters)[0].evidence,opportunity:applyFiltersToData([r],{...filters,opportunityMode:true})[0].score}))}]}))}
 writeFileSync('.vercel/model/impact.json',JSON.stringify(report,null,2),{mode:0o600})
 console.log(JSON.stringify({prepared:true,run:report.run,stations:report.stations,regions:report.regions,sql_bytes:Buffer.byteLength(sql),levels:Object.fromEntries(Object.entries(report.levels).map(([k,v])=>[k,{rated:v.rated,unrated:v.unrated,min:v.min,max:v.max,median:v.median,unrated_reasons:v.unrated_reasons}])),examples:report.levels.states.examples.filter(r=>['California','Vermont','Texas','Mississippi','Washington'].includes(r.region)).map(r=>({region:r.region,old:r.old,current:r.current,opportunity:r.opportunity,fleet:r.model?.estimated_plugin_vehicles,level2:r.model?.level2_ports,target_level2:r.model?.target_level2_ports,fast:r.model?.fast_ports,target_fast:r.model?.target_fast_ports}))}))

}finally{await server.close()}
