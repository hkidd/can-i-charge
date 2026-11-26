-- Live-schema review: geometries are stored separately from ZIP summaries.
-- Preserve the existing RPC signature, including its floating-point score type.
create or replace function public.get_zip_data_with_geometry(
    p_north double precision, p_south double precision,
    p_east double precision, p_west double precision
)
returns table (
    id uuid, zip_code text, county text, state text,
    center_lat double precision, center_lng double precision,
    population integer, charger_count integer, need_score double precision,
    ev_infrastructure_score double precision, avg_distance_to_charger double precision,
    fast_charger_count integer, zoom_range text, updated_at timestamptz,
    level1_count integer, level2_count integer, dcfast_count integer,
    total_ports integer, tesla_ports integer, ccs_ports integer,
    j1772_ports integer, chademo_ports integer, tesla_count integer,
    ccs_count integer, geometry public.geometry
)
language sql stable security invoker
set search_path = pg_catalog, public, extensions
set statement_timeout = '10s'
as $$
    select z.id, z.zip_code, z.county, z.state, z.center_lat, z.center_lng,
        z.population, z.charger_count, z.need_score,
        z.ev_infrastructure_score::double precision, z.avg_distance_to_charger,
        z.fast_charger_count, z.zoom_range, z.updated_at,
        z.level1_count, z.level2_count, z.dcfast_count,
        z.total_ports, z.tesla_ports, z.ccs_ports, z.j1772_ports, z.chademo_ports,
        z.tesla_count, z.ccs_count, g.geometry
    from public.zip_level_data z
    join public.zip_geometries g on g.zip_code = z.zip_code
    where z.center_lat between p_south and p_north
      and z.center_lng between p_west and p_east
    order by z.zip_code, z.state, z.id
$$;
-- No internal LIMIT: callers paginate the complete viewport.
revoke all on function public.get_zip_data_with_geometry(double precision,double precision,double precision,double precision)
    from public, anon, authenticated;
grant execute on function public.get_zip_data_with_geometry(double precision,double precision,double precision,double precision)
    to service_role;

-- These additional legacy publication entry points also bypass RLS. Retire
-- all four together, including execution by the previous backend role.
do $$
declare legacy_name text; table_name text;
begin
    foreach legacy_name in array array[
        'copy_staging_to_production', 'copy_state_staging_to_production',
        'copy_county_staging_to_production', 'copy_zip_staging_to_production'
    ] loop
        if to_regprocedure(format('public.%I()', legacy_name)) is not null then
            execute format('revoke all on function public.%I() from public, anon, authenticated, service_role', legacy_name);
        end if;
    end loop;
    -- Public ALL policies exist on the live county and ZIP tables. RLS alone
    -- cannot protect these writes; publication must use the guarded owner RPC.
    foreach table_name in array array[
        'charging_stations', 'state_level_data', 'county_level_data', 'zip_level_data'
    ] loop
        execute format('alter table public.%I enable row level security', table_name);
        execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from public, anon, authenticated, service_role', table_name);
    end loop;
end $$;
notify pgrst, 'reload schema';
