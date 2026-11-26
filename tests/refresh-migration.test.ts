import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { processNRELStation } from '@/lib/station-model'

let db: PGlite
const tables = ['charging_stations','state_level_data','county_level_data','zip_level_data']
const migration = ['20261124222811_station_refresh.sql', '20261124224006_refresh_safeupdate_compatibility.sql', '20261125143508_connector_filter_summaries.sql', '20261125144158_traffic_provenance.sql', '20261125150129_fleet_readiness_model.sql']
    .map(name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')).join('\n')
const id = '00000000-0000-4000-8000-000000000001'
const station = processNRELStation({ id: 1, station_name: 'New', latitude: 40, longitude: -105, state: 'CO', zip: '80000', ev_dc_fast_num: 2 })

async function scalar(sql: string, args: unknown[] = []) {
    const result = await db.query<Record<string, unknown>>(sql, args)
    return Object.values(result.rows[0])[0]
}
async function begin(count = 1) {
    const run = await scalar('select public.begin_station_refresh($1,1)', [count]) as { id: string }
    return run.id
}
async function write(run: string, table: string, rows: object[]) {
    return scalar('select public.write_station_refresh_batch($1,$2,$3::jsonb)', [run, table, JSON.stringify(rows)])
}
async function prepare(run: string) {
    await write(run, 'charging_stations', [station])
    await scalar('select public.mark_station_refresh_staged($1)', [run])
    await scalar('select public.claim_station_refresh($1)', [run])
    await write(run, 'state_level_data', [{ state_name: 'Colorado', center_lat: 40, center_lng: -105, charger_count: 1, total_ports: 2 }])
    await write(run, 'county_level_data', [{ county_name: 'Fixture', county_fips: '08001', state: 'CO', center_lat: 40, center_lng: -105, charger_count: 1, total_ports: 2 }])
    await write(run, 'zip_level_data', [{ zip_code: '80000', state: 'CO', center_lat: 40, center_lng: -105, charger_count: 1, total_ports: 2 }])
    await scalar('select public.finish_station_refresh_aggregates($1,1,1,1)', [run])
}

beforeAll(async () => {
    db = new PGlite()
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;')
    await db.exec(`create table public.charging_stations(
        id uuid primary key default gen_random_uuid(), name text, address text, zip text, state text,
        latitude double precision, longitude double precision, charger_type text, charger_type_detailed text,
        num_ports integer, ev_connector_types text[], network text, created_at timestamptz default now()
    );`)
    const common = 'id uuid primary key default gen_random_uuid(),center_lat double precision not null,center_lng double precision not null,population integer,charger_count integer,ev_infrastructure_score double precision,need_score double precision,zoom_range text,updated_at timestamptz default now()'
    await db.exec(`create table public.state_level_data(${common},state_name text);
      create table public.county_level_data(${common},county_name text,state text,daily_vmt double precision,vmt_per_capita double precision,traffic_score double precision);
      create table public.zip_level_data(${common},zip_code text,state text,county text,avg_distance_to_charger double precision);`)
    for (const table of tables) await db.exec(`create table public.${table}_staging (like public.${table} including all);`)
    await db.exec(migration)
}, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
    await db.exec('alter table public.zip_level_data drop constraint if exists fixture_failure;')
    await db.exec(`truncate ${tables.flatMap(table => [`public.${table}`, `public.${table}_staging`]).join(',')}, public.station_refresh_batches, public.station_refresh_runs;`)
    await db.query('insert into public.charging_stations(id,name,num_ports) values($1,\'Old\',1)', [id])
    await db.exec("insert into public.state_level_data(state_name,center_lat,center_lng,charger_count) values('Old',1,1,1); insert into public.county_level_data(county_name,center_lat,center_lng,charger_count) values('Old',1,1,1); insert into public.zip_level_data(zip_code,center_lat,center_lng,charger_count) values('99999',1,1,1);")
})

describe('transactional station refresh migration', () => {
    it('can be reapplied without replacing production rows', async () => {
        await db.exec(migration)
        expect(await scalar('select name from public.charging_stations')).toBe('Old')
    })
    it('does not allow anonymous clients to start refreshes', async () => {
        await db.exec('set role anon')
        try { await expect(begin()).rejects.toThrow(/permission denied/) }
        finally { await db.exec('reset role') }
    })
    it('requires backend staging writes to go through the run-aware RPCs', async () => {
        await db.exec('set role service_role')
        try {
            await expect(db.exec("insert into public.charging_stations_staging(name) values('Direct')")).rejects.toThrow(/permission denied/)
            const run = await begin()
            expect(await write(run, 'charging_stations', [station])).toBe(1)
            expect(await scalar('select count(*)::integer from public.charging_stations_staging')).toBe(1)
            await expect(db.exec("update public.station_refresh_runs set status='ready'")).rejects.toThrow(/permission denied/)
        } finally { await db.exec('reset role') }
    })
    it('rejects overlapping jobs without clearing the active snapshot', async () => {
        const run = await begin()
        await write(run, 'charging_stations', [station])
        await expect(begin()).rejects.toThrow('already in progress')
        expect(await scalar('select count(*)::integer from public.charging_stations_staging')).toBe(1)
    })
    it('allows the same worker to retry a claim while excluding a different worker', async () => {
        const run = await begin()
        await write(run, 'charging_stations', [station])
        await scalar('select public.mark_station_refresh_staged($1)', [run])
        const worker = '00000000-0000-4000-8000-000000000002'
        await scalar('select public.claim_station_refresh($1,$2)', [run, worker])
        await expect(scalar('select public.claim_station_refresh($1,$2)', [run, worker])).resolves.toMatchObject({ status: 'aggregating' })
        await expect(scalar('select public.claim_station_refresh($1)', [run])).rejects.toThrow('not ready to claim')
    })
    it('makes a repeated batch delivery idempotent', async () => {
        const run = await begin()
        expect(await write(run, 'charging_stations', [station])).toBe(1)
        expect(await write(run, 'charging_stations', [station])).toBe(1)
        expect(await scalar('select count(*)::integer from public.charging_stations_staging')).toBe(1)
    })
    it('rolls back an entire malformed batch', async () => {
        const run = await begin(2)
        await expect(write(run, 'charging_stations', [station, station])).rejects.toThrow()
        expect(await scalar('select count(*)::integer from public.charging_stations_staging')).toBe(0)
        await expect(write(run, 'unrelated_table', [station])).rejects.toThrow('Unsupported staging table')
    })
    it('blocks incomplete staging and partial aggregates from publication', async () => {
        const run = await begin(2)
        await write(run, 'charging_stations', [station])
        await expect(scalar('select public.mark_station_refresh_staged($1)', [run])).rejects.toThrow('Incomplete')
        await expect(scalar('select public.publish_station_refresh($1)', [run])).rejects.toThrow('not ready')
        expect(await scalar('select name from public.charging_stations')).toBe('Old')
    })
    it('rejects stale job writes after an expired lease is replaced', async () => {
        const old = await begin()
        await db.query("update public.station_refresh_runs set lease_expires_at=now()-interval '1 second' where id=$1", [old])
        const current = await begin()
        await expect(write(old, 'charging_stations', [station])).rejects.toThrow('lease is not active')
        await write(current, 'charging_stations', [station])
        expect(await scalar('select refresh_run_id from public.charging_stations_staging')).toBe(current)
    })
    it('publishes every table together and treats a retry as a read', async () => {
        const run = await begin()
        await prepare(run)
        expect(await scalar('select name from public.charging_stations')).toBe('Old')
        const published = await scalar('select public.publish_station_refresh($1)', [run]) as { status: string }
        expect(published.status).toBe('published')
        expect(await scalar('select name from public.charging_stations')).toBe('New')
        expect(await scalar('select state_name from public.state_level_data')).toBe('Colorado')
        expect(await scalar('select county_name from public.county_level_data')).toBe('Fixture')
        expect(await scalar('select zip_code from public.zip_level_data')).toBe('80000')
        const next = await begin()
        await write(next, 'charging_stations', [{ ...station, name: 'Next' }])
        await scalar('select public.publish_station_refresh($1)', [run])
        expect(await scalar('select name from public.charging_stations')).toBe('New')
    })
    it('preserves every production table if the final table insert fails', async () => {
        const run = await begin()
        await prepare(run)
        await db.exec("alter table public.zip_level_data add constraint fixture_failure check(zip_code<>'80000') not valid")
        await expect(scalar('select public.publish_station_refresh($1)', [run])).rejects.toThrow()
        expect(await scalar('select name from public.charging_stations')).toBe('Old')
        expect(await scalar('select state_name from public.state_level_data')).toBe('Old')
        expect(await scalar('select county_name from public.county_level_data')).toBe('Old')
        expect(await scalar('select zip_code from public.zip_level_data')).toBe('99999')
        await scalar('select public.fail_station_refresh($1,$2)', [run, 'fixture publication error'])
        expect(await scalar('select status from public.station_refresh_runs where id=$1', [run])).toBe('ready')
        await db.exec('alter table public.zip_level_data drop constraint fixture_failure')
        await scalar('select public.publish_station_refresh($1)', [run])
        expect(await scalar('select name from public.charging_stations')).toBe('New')
    })
    it('revalidates the snapshot immediately before publication', async () => {
        const run = await begin()
        await prepare(run)
        await db.exec('delete from public.county_level_data_staging')
        await expect(scalar('select public.publish_station_refresh($1)', [run])).rejects.toThrow('changed after validation')
        expect(await scalar('select name from public.charging_stations')).toBe('Old')
    })
})
