import {config} from 'dotenv'
import {spawnSync} from 'node:child_process'

// One-time, resumable metadata backfill after the incremental-publication migration.
// Credentials remain in the process environment, never command arguments or logs.
process.umask(0o077)
config({path:'.env.local',quiet:true})
const c=new URL(process.env.DATABASE_URL)
if(!['postgres:','postgresql:'].includes(c.protocol)||!decodeURIComponent(c.username).includes('lwymugddoqggxkvilodu')||!c.hostname.endsWith('.supabase.com'))throw Error('Expected production Session pooler URI')
const password=decodeURIComponent(c.password)
const env={...process.env,PGHOST:c.hostname,PGPORT:c.port||'5432',PGUSER:decodeURIComponent(c.username),PGPASSWORD:password,PGDATABASE:c.pathname.slice(1),PGSSLMODE:'require',PGCONNECT_TIMEOUT:'20'}
const tables=['charging_stations','state_level_data','county_level_data','zip_level_data'].flatMap(t=>[t,t+'_staging'])
const counts=tables.map(t=>`select '${t}' as target,count(*) filter(where refresh_fingerprint is null) as remaining from public.${t}`).join(' union all ')
const apply=process.argv.includes('--apply')
const sql=apply?`set lock_timeout='5s'; set statement_timeout='240s';
do $$ declare t text; changed integer; begin
 foreach t in array array[${tables.map(t=>`'${t}'`).join(',')}] loop
  loop
   execute format('with batch as (select id from public.%I where refresh_fingerprint is null order by id limit 1000)
    update public.%I p set refresh_fingerprint=null from batch b where p.id is not null and p.id=b.id',t,t);
   get diagnostics changed=row_count;
   commit;
   exit when changed=0;
   perform pg_sleep(0.05);
  end loop;
 end loop;
end $$;
${counts};`: `set statement_timeout='15s'; ${counts};`
const result=spawnSync((process.env.PG_BIN||'/opt/homebrew/opt/postgresql@18/bin')+'/psql',['-X','-q','-v','ON_ERROR_STOP=1','-At'],{input:sql,env,encoding:'utf8',timeout:300000,maxBuffer:1024*1024})
if(result.status!==0)throw Error((result.stderr||result.error?.message||'Fingerprint backfill failed').replaceAll(password,'[redacted]'))
console.log(result.stdout.trim())
if(apply&&result.stdout.trim().split('\n').some(line=>line.split('|')[1]!=='0'))throw Error('Fingerprint backfill is incomplete')
