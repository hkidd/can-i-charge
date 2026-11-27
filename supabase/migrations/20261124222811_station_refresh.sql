-- Additive upgrade for the existing station and regional tables. Apply before deploying the app.
-- No production rows are replaced by this migration.
create table if not exists public.station_refresh_runs (
    id uuid primary key default gen_random_uuid(),
    status text not null check (status in ('fetching','staged','aggregating','ready','published','failed')),
    started_at timestamptz not null default clock_timestamp(),
    lease_expires_at timestamptz not null,
    completed_at timestamptz,
    worker_id uuid,
    station_count integer not null check (station_count > 0),
    minimum_station_count integer not null check (minimum_station_count > 0),
    state_count integer, county_count integer, zip_count integer,
    diagnostics jsonb not null default '{}',
    error text
);
create unique index if not exists station_refresh_single_active
    on public.station_refresh_runs ((1)) where status in ('fetching','staged','aggregating','ready');
create index if not exists station_refresh_latest_published
    on public.station_refresh_runs(completed_at desc) where status='published';
alter table public.station_refresh_runs enable row level security;
revoke all on public.station_refresh_runs from public, anon, authenticated, service_role;
grant select on public.station_refresh_runs to service_role;

create table if not exists public.station_refresh_batches (
    run_id uuid not null references public.station_refresh_runs(id),
    table_name text not null, batch_hash text not null, row_count integer not null,
    primary key(run_id,table_name,batch_hash)
);
alter table public.station_refresh_batches enable row level security;
revoke all on public.station_refresh_batches from public, anon, authenticated, service_role;

-- Retain UUID key columns while adding the provider's stable identity and all speeds.
do $$
declare t text;
begin
    foreach t in array array['charging_stations', 'charging_stations_staging'] loop
        execute format('alter table public.%I add column if not exists source_id bigint', t);
        execute format('alter table public.%I add column if not exists level1_ports integer', t);
        execute format('alter table public.%I add column if not exists level2_ports integer', t);
        execute format('alter table public.%I add column if not exists dcfast_ports integer', t);
        execute format('alter table public.%I add column if not exists port_counts_known boolean', t);
        execute format('alter table public.%I add column if not exists access_code text', t);
        execute format('alter table public.%I add column if not exists restricted_access boolean', t);
        execute format('alter table public.%I add column if not exists charging_units jsonb', t);
        execute format('alter table public.%I add column if not exists charging_units_complete boolean', t);
        execute format('create unique index if not exists %I on public.%I (source_id)', t || '_source_identity', t);
    end loop;
    foreach t in array array['state_level_data','county_level_data','zip_level_data',
                            'state_level_data_staging','county_level_data_staging','zip_level_data_staging'] loop
        execute format('alter table public.%I add column if not exists level1_count integer', t);
        execute format('alter table public.%I add column if not exists level2_count integer', t);
        execute format('alter table public.%I add column if not exists dcfast_count integer', t);
        execute format('alter table public.%I add column if not exists fast_charger_count integer', t);
        execute format('alter table public.%I add column if not exists total_ports integer', t);
        execute format('alter table public.%I add column if not exists level1_ports integer', t);
        execute format('alter table public.%I add column if not exists level2_ports integer', t);
        execute format('alter table public.%I add column if not exists dcfast_ports integer', t);
        execute format('alter table public.%I add column if not exists unknown_port_station_count integer', t);
        execute format('alter table public.%I add column if not exists tesla_count integer', t);
        execute format('alter table public.%I add column if not exists ccs_count integer', t);
        execute format('alter table public.%I add column if not exists j1772_count integer', t);
        execute format('alter table public.%I add column if not exists chademo_count integer', t);
        execute format('alter table public.%I add column if not exists tesla_ports integer', t);
        execute format('alter table public.%I add column if not exists ccs_ports integer', t);
        execute format('alter table public.%I add column if not exists j1772_ports integer', t);
        execute format('alter table public.%I add column if not exists chademo_ports integer', t);
        execute format('alter table public.%I add column if not exists connector_ports_complete boolean', t);
        execute format('alter table public.%I add column if not exists population_source text', t);
        execute format('alter table public.%I add column if not exists data_version text', t);
        execute format('alter table public.%I add column if not exists scoring_version text', t);
        execute format('alter table public.%I add column if not exists updated_at timestamptz', t);
    end loop;
    foreach t in array array['county_level_data','county_level_data_staging'] loop
        execute format('alter table public.%I add column if not exists county_fips text', t);
    end loop;
    foreach t in array array['charging_stations_staging','state_level_data_staging','county_level_data_staging','zip_level_data_staging'] loop
        execute format('alter table public.%I add column if not exists refresh_run_id uuid', t);
        execute format('create index if not exists %I on public.%I(refresh_run_id)', t || '_refresh_run', t);
        execute format('alter table public.%I enable row level security', t);
        execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
        execute format('grant select on public.%I to service_role', t);
    end loop;
end $$;

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
    delete from public.charging_stations_staging;
    delete from public.state_level_data_staging;
    delete from public.county_level_data_staging;
    delete from public.zip_level_data_staging;
    return to_jsonb(r);
end $$;

create or replace function public.write_station_refresh_batch(p_run_id uuid, p_table text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = pg_catalog, public set statement_timeout = '55s' set lock_timeout = '5s' as $$
declare r public.station_refresh_runs; target text; columns_sql text; rows_json jsonb; inserted integer; batch_hash_value text;
begin
    select * into r from public.station_refresh_runs where id=p_run_id for update;
    if not found or r.lease_expires_at <= clock_timestamp() then raise exception 'Refresh lease is not active'; end if;
    if p_table not in ('charging_stations','state_level_data','county_level_data','zip_level_data') then raise exception 'Unsupported staging table'; end if;
    if (p_table='charging_stations' and r.status <> 'fetching') or
       (p_table<>'charging_stations' and r.status <> 'aggregating') then raise exception 'Refresh phase does not allow this batch'; end if;
    if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Invalid staging batch'; end if;
    batch_hash_value := encode(sha256(convert_to(p_rows::text,'UTF8')),'hex');
    select row_count into inserted from public.station_refresh_batches where run_id=p_run_id and table_name=p_table and batch_hash=batch_hash_value;
    if found then return inserted; end if;
    target := p_table || '_staging';
    select jsonb_agg(value || jsonb_build_object('refresh_run_id',p_run_id)) into rows_json from jsonb_array_elements(p_rows);
    -- Every row must have exactly the same keys, and every key must be a real table column.
    if exists(select 1 from jsonb_array_elements(rows_json) row_data where
        (select array_agg(k order by k) from jsonb_object_keys(row_data) k) <>
        (select array_agg(k order by k) from jsonb_object_keys(rows_json->0) k)) then raise exception 'Inconsistent batch fields'; end if;
    if exists(select 1 from jsonb_object_keys(rows_json->0) k where not exists(
        select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=target and c.column_name=k)) then
        raise exception 'Staging schema is missing required columns';
    end if;
    select string_agg(format('%I',k),',' order by k) into columns_sql from jsonb_object_keys(rows_json->0) k;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1)', target, columns_sql, columns_sql, target) using rows_json;
    get diagnostics inserted = row_count;
    insert into public.station_refresh_batches(run_id,table_name,batch_hash,row_count) values(p_run_id,p_table,batch_hash_value,inserted);
    update public.station_refresh_runs set lease_expires_at=clock_timestamp()+interval '6 minutes' where id=p_run_id;
    return inserted;
end $$;

create or replace function public.mark_station_refresh_staged(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public set statement_timeout = '55s' set lock_timeout = '5s' as $$
declare r public.station_refresh_runs; n integer;
begin
    select * into r from public.station_refresh_runs where id=p_run_id for update;
    if found and r.status='staged' and r.lease_expires_at>clock_timestamp() then return to_jsonb(r); end if;
    if not found or r.status<>'fetching' or r.lease_expires_at <= clock_timestamp() then raise exception 'Refresh is not accepting stations'; end if;
    select count(*) into n from public.charging_stations_staging where refresh_run_id=p_run_id;
    if n<>r.station_count then raise exception 'Incomplete station snapshot'; end if;
    update public.station_refresh_runs set status='staged',lease_expires_at=clock_timestamp()+interval '60 minutes' where id=p_run_id returning * into r;
    return to_jsonb(r);
end $$;

create or replace function public.claim_station_refresh(p_run_id uuid default null, p_worker_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = pg_catalog, public set statement_timeout = '55s' set lock_timeout = '5s' as $$
declare r public.station_refresh_runs;
begin
    perform pg_advisory_xact_lock(78391142);
    if p_run_id is null then
        select * into r from public.station_refresh_runs where status in ('staged','ready') order by started_at desc limit 1 for update;
    else
        select * into r from public.station_refresh_runs where id=p_run_id for update;
    end if;
    if not found then raise exception 'No staged refresh is available'; end if;
    if r.status='published' then return to_jsonb(r); end if;
    if r.status='aggregating' and r.worker_id=p_worker_id and r.lease_expires_at>clock_timestamp() then return to_jsonb(r); end if;
    if r.status not in ('staged','ready') then raise exception 'Refresh is not ready to claim' using errcode='55P03'; end if;
    if r.lease_expires_at <= clock_timestamp() then raise exception 'Refresh lease expired; start a new snapshot'; end if;
    update public.station_refresh_runs set worker_id=p_worker_id,status=case when status='ready' then 'ready' else 'aggregating' end,
      lease_expires_at=clock_timestamp()+interval '6 minutes' where id=r.id returning * into r;
    return to_jsonb(r);
end $$;

create or replace function public.finish_station_refresh_aggregates(p_run_id uuid, p_states integer, p_counties integer, p_zips integer, p_diagnostics jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public set statement_timeout = '55s' set lock_timeout = '5s' as $$
declare r public.station_refresh_runs; ns integer; nc integer; nz integer; station_sum bigint; zip_sum bigint; county_sum bigint; zipped integer; unassigned integer; station_ports bigint; region_ports bigint;
begin
    select * into r from public.station_refresh_runs where id=p_run_id for update;
    if found and r.status='ready' and r.lease_expires_at>clock_timestamp() and r.state_count=p_states and r.county_count=p_counties and r.zip_count=p_zips and r.diagnostics=p_diagnostics then return to_jsonb(r); end if;
    if not found or r.status<>'aggregating' or r.lease_expires_at <= clock_timestamp() then raise exception 'Refresh is not aggregating'; end if;
    select count(*),coalesce(sum(charger_count),0) into ns,station_sum from public.state_level_data_staging where refresh_run_id=p_run_id;
    select count(*),coalesce(sum(charger_count),0) into nc,county_sum from public.county_level_data_staging where refresh_run_id=p_run_id;
    select count(*),coalesce(sum(charger_count),0) into nz,zip_sum from public.zip_level_data_staging where refresh_run_id=p_run_id;
    select count(*) into zipped from public.charging_stations_staging where refresh_run_id=p_run_id and zip is not null;
    select coalesce(sum(num_ports),0) into station_ports from public.charging_stations_staging where refresh_run_id=p_run_id;
    select coalesce(sum(total_ports),0) into region_ports from public.state_level_data_staging where refresh_run_id=p_run_id;
    if station_ports<>region_ports then raise exception 'Aggregate port totals failed validation'; end if;
    unassigned := coalesce((p_diagnostics->>'unassigned_county_stations')::integer,0);
    if unassigned<0 or county_sum+unassigned<>r.station_count then raise exception 'County coverage failed validation'; end if;
    if exists(select 1 from public.state_level_data_staging where refresh_run_id=p_run_id group by state_name having count(*)>1) or
       exists(select 1 from public.county_level_data_staging where refresh_run_id=p_run_id group by county_fips having count(*)>1) or
       exists(select 1 from public.zip_level_data_staging where refresh_run_id=p_run_id group by zip_code having count(*)>1) then
        raise exception 'Duplicate aggregate regions';
    end if;
    if p_states<1 or p_counties<1 or p_zips<1 or ns<>p_states or nc<>p_counties or nz<>p_zips or station_sum<>r.station_count or zip_sum<>zipped then
        raise exception 'Aggregate snapshot failed completeness validation';
    end if;
    update public.station_refresh_runs set status='ready',lease_expires_at=clock_timestamp()+interval '60 minutes',state_count=ns,county_count=nc,zip_count=nz,diagnostics=p_diagnostics where id=p_run_id returning * into r;
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
        execute format('delete from public.%I',t);
        execute format('insert into public.%I (%s) select %s from public.%I where refresh_run_id=$1',t,columns_sql,columns_sql,t || '_staging') using p_run_id;
    end loop;
    update public.station_refresh_runs set status='published',completed_at=clock_timestamp() where id=p_run_id returning * into r;
    return to_jsonb(r);
end $$;

create or replace function public.fail_station_refresh(p_run_id uuid, p_error text)
returns void language plpgsql security definer set search_path = pg_catalog, public set statement_timeout = '55s' set lock_timeout = '5s' as $$
begin
    update public.station_refresh_runs set status=case when status='ready' then 'ready' else 'failed' end,
      error=left(p_error,2000),completed_at=case when status='ready' then null else clock_timestamp() end
      where id=p_run_id and status in ('fetching','staged','aggregating','ready');
end $$;

-- Restrict the new mutation API to the backend role. Anonymous clients cannot invoke it.
revoke all on function public.begin_station_refresh(integer,integer,uuid) from public, anon, authenticated;
revoke all on function public.write_station_refresh_batch(uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.mark_station_refresh_staged(uuid) from public, anon, authenticated;
revoke all on function public.claim_station_refresh(uuid,uuid) from public, anon, authenticated;
revoke all on function public.finish_station_refresh_aggregates(uuid,integer,integer,integer,jsonb) from public, anon, authenticated;
revoke all on function public.publish_station_refresh(uuid) from public, anon, authenticated;
revoke all on function public.fail_station_refresh(uuid,text) from public, anon, authenticated;
grant execute on function public.begin_station_refresh(integer,integer,uuid), public.write_station_refresh_batch(uuid,text,jsonb),
 public.mark_station_refresh_staged(uuid), public.claim_station_refresh(uuid,uuid),
 public.finish_station_refresh_aggregates(uuid,integer,integer,integer,jsonb), public.publish_station_refresh(uuid), public.fail_station_refresh(uuid,text) to service_role;

-- Retire the unguarded publication entry point while keeping it available to the database owner.
do $$ begin
    if to_regprocedure('public.copy_staging_to_production()') is not null then
        execute 'revoke all on function public.copy_staging_to_production() from public, anon, authenticated, service_role';
    end if;
end $$;
notify pgrst, 'reload schema';
