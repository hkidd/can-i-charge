import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

let db: PGlite
const legacy = ['copy_staging_to_production', 'copy_state_staging_to_production',
    'copy_county_staging_to_production', 'copy_zip_staging_to_production']

beforeAll(async () => {
    db = new PGlite()
    // A text domain exercises the relational RPC contract without pretending
    // to validate PostGIS serialization or spatial operations.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        grant usage on schema public to anon, authenticated, service_role;
        create domain public.geometry as text;
        create table public.zip_level_data (
            id uuid default gen_random_uuid(), zip_code text, county text, state text,
            center_lat double precision, center_lng double precision,
            population integer, charger_count integer, need_score double precision,
            ev_infrastructure_score integer, avg_distance_to_charger double precision,
            fast_charger_count integer, zoom_range text, updated_at timestamptz,
            level1_count integer, level2_count integer, dcfast_count integer,
            total_ports integer, tesla_ports integer, ccs_ports integer,
            j1772_ports integer, chademo_ports integer, tesla_count integer, ccs_count integer
        );
        create table public.zip_geometries(zip_code text primary key, geometry public.geometry);
        create table public.charging_stations(id uuid);
        create table public.state_level_data(id uuid);
        create table public.county_level_data(id uuid);
        grant all on all tables in schema public to anon, authenticated, service_role;
        insert into public.zip_level_data(zip_code,state,center_lat,center_lng,ev_infrastructure_score)
            select lpad(i::text,5,'0'),'CO',39.7,-105,42 from generate_series(1,1005) i;
        insert into public.zip_geometries select zip_code,'fixture-polygon' from public.zip_level_data;`)
    for (const name of legacy) await db.exec(`create function public.${name}() returns void
        language sql security definer as 'select'; grant execute on function public.${name}() to anon, authenticated, service_role;`)
    await db.exec(readFileSync(new URL('../supabase/migrations/20261124222818_production_schema_compatibility.sql', import.meta.url), 'utf8'))
})
afterAll(async () => db?.close())

it('joins separate geometry rows and exposes pages beyond the old 1,000-row cap', async () => {
    const result = await db.query(`select zip_code,ev_infrastructure_score,geometry
        from public.get_zip_data_with_geometry(40,39,-104,-106) offset 1000 limit 10`)
    expect(result.rows).toHaveLength(5)
    expect(result.rows[0]).toEqual({ zip_code: '01001', ev_infrastructure_score: 42, geometry: 'fixture-polygon' })
    expect((await db.query('select * from public.get_zip_data_with_geometry(38,37,-104,-106)')).rows).toEqual([])
})

it('retires every legacy publication RPC for public and backend application roles', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) {
        await db.exec(`set role ${role}`)
        try {
            for (const name of legacy) {
                await expect(db.query(`select public.${name}()`)).rejects.toThrow('permission denied')
            }
            for (const table of ['charging_stations', 'state_level_data', 'county_level_data', 'zip_level_data']) {
                await expect(db.exec(`delete from public.${table}`)).rejects.toThrow('permission denied')
            }
        } finally { await db.exec('reset role') }
    }
    expect((await db.query('select count(*)::integer as count from public.zip_level_data')).rows).toEqual([{ count: 1005 }])
})
