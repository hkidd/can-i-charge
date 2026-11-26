import {config} from 'dotenv'
import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
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
// A single read-only transaction captures station and regional data from the same publication.
const source={stations:[],states:[],counties:[],zips:[]}
const rows=run(`begin isolation level repeatable read read only;
select json_build_object('kind','run','data',id) from public.station_refresh_runs where status='published' order by completed_at desc limit 1;
select json_build_object('kind','stations','data',s) from public.charging_stations s;
select json_build_object('kind','states','data',s) from public.state_level_data s;
select json_build_object('kind','counties','data',s) from public.county_level_data s;
select json_build_object('kind','zips','data',s) from public.zip_level_data s;
commit;`)
for(const line of rows.split('\n')){const row=JSON.parse(line);if(row.kind==='run')source.run=row.data;else source[row.kind].push(row.data)}

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
   return {key:row[key],filter_summary:row.filter_summary}
  })
  if(updates.length!==existing.size)throw Error(`Region count mismatch: ${table}`)
  for(const target of [table,table+'_staging'])for(let offset=0;offset<updates.length;offset+=250){
   const json=JSON.stringify(updates.slice(offset,offset+250)).replaceAll("'","''")
   sql+=`update public.${target} t set filter_summary=u.filter_summary from jsonb_to_recordset('${json}'::jsonb) as u(key text,filter_summary jsonb) where t.${key}=u.key;\n`
  }
 }
 sql+='commit;\n'
 mkdirSync('.vercel',{recursive:true})
 writeFileSync('.vercel/filter-backfill.sql',sql,{mode:0o600})
 const filters={showDCFast:true,showLevel2:true,showLevel1:true,showTesla:true,showCCS:true,usePortWeighting:true}
 const report={run:source.run,stations:source.stations.length,regions:Object.fromEntries(definitions.map(([, , field])=>[field,snapshot[field].length])),states:snapshot.states.map(row=>({name:row.state_name,score:row.ev_infrastructure_score,tesla:applyFiltersToData([row],{...filters,showCCS:false})[0],other:applyFiltersToData([row],{...filters,showTesla:false})[0]}))}
 writeFileSync('.vercel/filter-impact.json',JSON.stringify(report),{mode:0o600})
 console.log(JSON.stringify({prepared:true,run:report.run,stations:report.stations,regions:report.regions,sql_bytes:Buffer.byteLength(sql),california:report.states.find(s=>s.name==='California')}))
 if(process.argv.includes('--apply')){run(sql);console.log('Backfill committed; regional scores and station rows unchanged.')}
}finally{await server.close()}
