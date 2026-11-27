-- Honor the live project's safeupdate guard without disabling it.
-- All four snapshot tables have non-null UUID primary keys.
create or replace function public.begin_station_refresh(p_station_count integer, p_minimum_station_count integer default 40000, p_run_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = pg_catalog, public set statement_timeout = '55s' set lock_timeout = '5s' as $$
declare r public.station_refresh_runs; previous_count integer;
begin
    perform pg_advisory_xact_lock(78391142);
    select * into r from public.station_refresh_runs where id=p_run_id for update;
    if found then
        if r.status='fetching' and r.station_count=p_station_count and r.lease_expires_at>clock_timestamp() then return to_jsonb(r); end if;
        raise exception 'Refresh identity was already used';
    end if;
    if p_minimum_station_count < 1 or p_station_count < p_minimum_station_count then
        raise exception 'Station snapshot is too small';
    end if;
    update public.station_refresh_runs set status='failed', error='Refresh lease expired', completed_at=clock_timestamp()
      where status in ('fetching','staged','aggregating','ready') and lease_expires_at <= clock_timestamp();
    if exists(select 1 from public.station_refresh_runs where status in ('fetching','staged','aggregating','ready')) then
        raise exception 'Another refresh is already in progress' using errcode='55P03';
    end if;
    select station_count into previous_count from public.station_refresh_runs where status='published' order by completed_at desc limit 1;
    if previous_count is not null and p_station_count < previous_count * 0.8 then
        raise exception 'Station snapshot fell by more than 20 percent';
    end if;
    insert into public.station_refresh_runs(id,status,lease_expires_at,station_count,minimum_station_count)
      values(p_run_id,'fetching',clock_timestamp()+interval '6 minutes',p_station_count,p_minimum_station_count) returning * into r;
    delete from public.charging_stations_staging where id is not null;
    delete from public.state_level_data_staging where id is not null;
    delete from public.county_level_data_staging where id is not null;
    delete from public.zip_level_data_staging where id is not null;
    return to_jsonb(r);
end $$;

create or replace function public.publish_station_refresh(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public set statement_timeout = '55s' set lock_timeout = '5s' as $$
declare r public.station_refresh_runs; t text; columns_sql text; expected integer; actual integer;
begin
    perform pg_advisory_xact_lock(78391142);
    select * into r from public.station_refresh_runs where id=p_run_id for update;
    if not found then raise exception 'Refresh not found'; end if;
    if r.status='published' then return to_jsonb(r); end if;
    if r.status<>'ready' or r.lease_expires_at <= clock_timestamp() then raise exception 'Refresh is not ready for publication'; end if;
    foreach t in array array['charging_stations','state_level_data','county_level_data','zip_level_data'] loop
        expected := case t when 'charging_stations' then r.station_count when 'state_level_data' then r.state_count when 'county_level_data' then r.county_count else r.zip_count end;
        execute format('select count(*) from public.%I where refresh_run_id=$1',t || '_staging') into actual using p_run_id;
        if expected is null or expected<1 or actual<>expected then raise exception 'Snapshot changed after validation'; end if;
    end loop;
    foreach t in array array['charging_stations','state_level_data','county_level_data','zip_level_data'] loop
        select string_agg(format('%I',p.column_name),',' order by p.ordinal_position) into columns_sql
          from information_schema.columns p join information_schema.columns s
          on s.table_schema='public' and s.table_name=t || '_staging' and s.column_name=p.column_name
          where p.table_schema='public' and p.table_name=t and p.is_generated='NEVER';
        execute format('delete from public.%I where id is not null',t);
        execute format('insert into public.%I (%s) select %s from public.%I where refresh_run_id=$1',t,columns_sql,columns_sql,t || '_staging') using p_run_id;
    end loop;
    update public.station_refresh_runs set status='published',completed_at=clock_timestamp() where id=p_run_id returning * into r;
    return to_jsonb(r);
end $$;

notify pgrst, 'reload schema';
