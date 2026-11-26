import {config} from 'dotenv'
import {spawnSync} from 'node:child_process'
import {createReadStream,mkdirSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createInterface} from 'node:readline'
import {createServer} from 'vite'

process.umask(0o077)
config({path:'.env.local',quiet:true})
const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'})
try{
 const {parseAnnualTraffic,trafficForCounty,TRAFFIC_SOURCE,TRAFFIC_YEAR,TRAFFIC_SHA256}=await server.ssrLoadModule('/lib/traffic-data.ts')
 const file=process.argv.find(arg=>arg.startsWith('--file='))?.slice(7)
 if(!file)throw Error('Supply --file=PATH to the verified EPA FF10 source. This command defaults to a dry run; --apply publishes after review.')
 const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk)
 const sha256=hash.digest('hex')
 if(sha256!==TRAFFIC_SHA256)throw Error('Source archive checksum differs from the reviewed EPA release')
 const {counties,rows}=await parseAnnualTraffic(createInterface({input:createReadStream(file),crlfDelay:Infinity}))
 const total=[...counties.values()].reduce((a,b)=>a+b,0)
 if(counties.size<3000||total<2e12||total>5e12)throw Error('Traffic coverage or units failed the national plausibility check')
 const connection=new URL(process.env.DATABASE_URL)
 if(!decodeURIComponent(connection.username).includes('lwymugddoqggxkvilodu')||!connection.hostname.endsWith('.supabase.com'))throw Error('Expected production Session pooler')
 const password=decodeURIComponent(connection.password)
 const env={...process.env,PGHOST:connection.hostname,PGPORT:connection.port||'5432',PGUSER:decodeURIComponent(connection.username),PGPASSWORD:password,PGDATABASE:connection.pathname.slice(1),PGSSLMODE:'require',PGCONNECT_TIMEOUT:'20'}
 const run=sql=>{const r=spawnSync('/opt/homebrew/opt/postgresql@18/bin/psql',['-X','-q','-v','ON_ERROR_STOP=1','-At'],{input:sql,env,encoding:'utf8',maxBuffer:10*1024*1024});if(r.status!==0)throw Error((r.stderr||'Database command failed').replaceAll(password,'[redacted]'));return r.stdout.trim()}
 const existing=JSON.parse(run('select json_agg(json_build_object(\'fips\',county_fips,\'state\',state,\'population\',population)) from public.county_level_data;'))
 const {US_STATES}=await server.ssrLoadModule('/lib/us-states.ts')
 const now=new Date().toISOString()
 const updates=existing.filter(row=>trafficForCounty(counties,row.fips)!==undefined).map(row=>({key:row.fips,traffic_data:{source:TRAFFIC_SOURCE,source_sha256:sha256,year:TRAFFIC_YEAR,annual_vmt:trafficForCounty(counties,row.fips),retrieved_at:now,scope:'county',county_count:1,expected_county_count:1}}))
 const stateUpdates=US_STATES.map(state=>{const expected=existing.filter(c=>c.state===state.code);const matched=expected.filter(c=>trafficForCounty(counties,c.fips)!==undefined);return{key:state.name,traffic_data:{source:TRAFFIC_SOURCE,source_sha256:sha256,year:TRAFFIC_YEAR,annual_vmt:matched.reduce((n,c)=>n+trafficForCounty(counties,c.fips),0),retrieved_at:now,scope:'state',county_count:matched.length,expected_county_count:expected.length}}}).filter(row=>row.traffic_data.county_count>0)
 const missing=existing.filter(row=>trafficForCounty(counties,row.fips)===undefined).map(row=>row.fips)
 const report={source:TRAFFIC_SOURCE,year:TRAFFIC_YEAR,sha256,rows,source_counties:counties.size,boundary_crosswalk:{'02261':['02063','02066']},matched_counties:updates.length,total_counties:existing.length,unmatched_counties:missing,complete_states:stateUpdates.filter(row=>row.traffic_data.county_count===row.traffic_data.expected_county_count).length,annual_vmt:total}
 let sql="begin;\nset local lock_timeout='5s';\nselect pg_advisory_xact_lock(78391142);\ndo $$ begin if exists(select 1 from public.station_refresh_runs where status in ('fetching','staged','aggregating','ready')) then raise exception 'Traffic import requires no active refresh'; end if; end $$;\n"
 for(const [table,key,data]of[['county_level_data','county_fips',updates],['state_level_data','state_name',stateUpdates]])for(const target of[table,table+'_staging']){
  const json=JSON.stringify(data).replaceAll("'","''")
  const legacy=table.startsWith('county')?`,daily_vmt=(u.traffic_data->>'annual_vmt')::numeric/365,vmt_per_capita=case when t.population>0 then (u.traffic_data->>'annual_vmt')::numeric/365/t.population else null end`:''
  sql+=`update public.${target} t set traffic_data=u.traffic_data${legacy} from jsonb_to_recordset('${json}'::jsonb) as u(key text,traffic_data jsonb) where t.${key}=u.key;\n`
 }
 sql+='commit;\n'
 mkdirSync('.vercel/traffic',{recursive:true});writeFileSync('.vercel/traffic/import-report.json',JSON.stringify(report,null,2),{mode:0o600});writeFileSync('.vercel/traffic/import.sql',sql,{mode:0o600});console.log(JSON.stringify(report))
 if(process.argv.includes('--apply')){run(sql);console.log('Traffic observations committed with year, source, and coverage. No readiness scores changed.')}
}finally{await server.close()}
