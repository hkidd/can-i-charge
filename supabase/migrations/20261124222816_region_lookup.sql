-- Prefer a ZIP that covers the point. Missing ZIP geometry falls back to the
-- bundled county boundaries in the application, never to a nearby centroid.
create or replace function public.find_zip_region(p_lat double precision, p_lng double precision)
returns setof public.zip_level_data
language plpgsql security invoker
set search_path = pg_catalog, public, extensions
set statement_timeout = '5s'
as $$
begin
    if p_lat is null or p_lng is null or not (p_lat between -90 and 90 and p_lng between -180 and 180) then
        raise exception 'Invalid coordinates';
    end if;
    return query execute '
        select z.* from public.zip_level_data z
        join public.zip_geometries g on g.zip_code = z.zip_code
        where ST_Covers(g.geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
        order by z.zip_code limit 1'
        using p_lng, p_lat;
exception
    when undefined_table or undefined_column or undefined_function then
        -- Geometry is optional; operational errors must still reach the caller.
        return;
end;
$$;
revoke all on function public.find_zip_region(double precision, double precision) from public, anon, authenticated;
grant execute on function public.find_zip_region(double precision, double precision) to service_role;
notify pgrst, 'reload schema';
