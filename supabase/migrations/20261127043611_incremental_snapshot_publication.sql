-- Publish changes atomically without deleting/rebuilding every production row/index.
-- Ready snapshots remain immutable; RLS, table OIDs, grants, and geometry joins are retained.
create unique index if not exists refresh_state_key on public.state_level_data(state_name);
create unique index if not exists refresh_state_staging_key on public.state_level_data_staging(state_name);
create unique index if not exists refresh_county_key on public.county_level_data(county_fips);
create unique index if not exists refresh_county_staging_key on public.county_level_data_staging(county_fips);
create unique index if not exists refresh_zip_staging_key on public.zip_level_data_staging(zip_code,state);

-- Hash canonical material content on write, so publication joins only small keys/digests.
-- Trigger execution uses the existing guarded writer's permissions; it grants no new write access.
create or replace function public.set_refresh_fingerprint()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare content jsonb;
begin
    content := to_jsonb(new) - array['id','created_at','updated_at','refresh_run_id','refresh_fingerprint'];
    if jsonb_typeof(content->'demand_data'->'national_road_miles_per_capita')='number' then
        content := jsonb_set(content,'{demand_data,national_road_miles_per_capita}',
            to_jsonb(round((content->'demand_data'->>'national_road_miles_per_capita')::numeric,10)));
    end if;
    new.refresh_fingerprint := encode(sha256(convert_to(content::text,'UTF8')),'hex');
    return new;
end $$;
revoke all on function public.set_refresh_fingerprint() from public,anon,authenticated;

do $$
declare t text; target text;
begin
    foreach t in array array['charging_stations','state_level_data','county_level_data','zip_level_data'] loop
        foreach target in array array[t,t || '_staging'] loop
            execute format('alter table public.%I add column if not exists refresh_fingerprint text',target);
            execute format('drop trigger if exists maintain_refresh_fingerprint on public.%I',target);
            execute format('create trigger maintain_refresh_fingerprint before insert or update on public.%I
                for each row execute function public.set_refresh_fingerprint()',target);
            -- Seed existing rows separately in bounded committed batches; avoid holding
            -- ALTER TABLE's exclusive lock during a production-wide backfill.
        end loop;
    end loop;
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
    -- Ready snapshots are immutable and already validated; a failed publication can be retried.
    if r.status <> 'ready' and r.lease_expires_at <= clock_timestamp() then raise exception 'Refresh lease expired; start a new snapshot'; end if;
    update public.station_refresh_runs set worker_id=p_worker_id,status=case when status='ready' then 'ready' else 'aggregating' end,
      lease_expires_at=clock_timestamp()+interval '6 minutes' where id=r.id returning * into r;
    return to_jsonb(r);
end $$;

create or replace function public.publish_station_refresh(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
set statement_timeout = '55s' set lock_timeout = '5s' set work_mem = '8MB' as $$
declare
    r public.station_refresh_runs;
    t text; keys text[]; key_match text; null_keys text;
    columns_sql text; source_columns text; updates text; comparisons text;
    expected integer; actual integer; missing_key boolean;
    inserted integer; changed integer; removed integer; step_started timestamptz;
    publication jsonb := '{}'::jsonb;
begin
    perform pg_advisory_xact_lock(78391142);
    select * into r from public.station_refresh_runs where id=p_run_id for update;
    if not found then raise exception 'Refresh not found'; end if;
    if r.status='published' then return to_jsonb(r); end if;
    if r.status<>'ready' or r.lease_expires_at <= clock_timestamp() then
        raise exception 'Refresh is not ready for publication';
    end if;
    -- Validate all four tables before changing any production row.
    foreach t in array array['charging_stations','state_level_data','county_level_data','zip_level_data'] loop
        expected := case t when 'charging_stations' then r.station_count when 'state_level_data' then r.state_count
            when 'county_level_data' then r.county_count else r.zip_count end;
        execute format('select count(*),coalesce(bool_or(refresh_fingerprint is null),false) from public.%I where refresh_run_id=$1',t || '_staging') into actual,missing_key using p_run_id;
        if expected is null or expected<1 or actual<>expected then
            raise exception 'Snapshot changed after validation';
        end if;
        if missing_key then raise exception 'Refresh fingerprint backfill must complete before publication'; end if;
        execute format('select exists(select 1 from public.%I where refresh_fingerprint is null)',t) into missing_key;
        if missing_key then raise exception 'Refresh fingerprint backfill must complete before publication'; end if;
    end loop;
    foreach t in array array['charging_stations','state_level_data','county_level_data','zip_level_data'] loop
        step_started := clock_timestamp();
        keys := case t when 'charging_stations' then array['id'] when 'state_level_data' then array['state_name']
            when 'county_level_data' then array['county_fips'] else array['zip_code','state'] end;
        select string_agg(format('p.%1$I=s.%1$I',k),' and '),
               string_agg(format('s.%I is null',k),' or ')
            into key_match,null_keys from unnest(keys) k;
        execute format('select exists(select 1 from public.%I s where s.refresh_run_id=$1 and (%s))',
            t || '_staging',null_keys) into missing_key using p_run_id;
        if missing_key then raise exception 'Snapshot contains a missing publication key for %',t; end if;

        -- Existing IDs/creation dates remain stable; updated_at alone is not a data change.
        select string_agg(format('%I',p.column_name),',' order by p.ordinal_position),
               string_agg(format('s.%I',p.column_name),',' order by p.ordinal_position),
               string_agg(format('%1$I=s.%1$I',p.column_name),',' order by p.ordinal_position)
                   filter(where p.column_name not in ('id','created_at') and not p.column_name=any(keys)),
               'p.refresh_fingerprint is distinct from s.refresh_fingerprint'
          into columns_sql,source_columns,updates,comparisons
          from information_schema.columns p join information_schema.columns s
            on s.table_schema='public' and s.table_name=t || '_staging' and s.column_name=p.column_name
          where p.table_schema='public' and p.table_name=t and p.is_generated='NEVER'
            and p.column_name<>'refresh_fingerprint';
        execute format('with changed as materialized (
                select p.id as production_id,s.id as staging_id from public.%I p join public.%I s on %s
                where s.refresh_run_id=$1 and (%s)
            ) update public.%I p set %s from changed c cross join lateral
              (select * from public.%I q where q.id=c.staging_id offset 0) s
              where p.id is not null and p.id=c.production_id',
            t,t || '_staging',key_match,comparisons,t,updates,t || '_staging') using p_run_id;
        get diagnostics changed = row_count;
        execute format('insert into public.%I (%s) select %s from public.%I s where s.refresh_run_id=$1
            and not exists(select 1 from public.%I p where %s)',
            t,columns_sql,source_columns,t || '_staging',t,key_match) using p_run_id;
        get diagnostics inserted = row_count;
        execute format('delete from public.%I p where p.id is not null
            and not exists(select 1 from public.%I s where s.refresh_run_id=$1 and %s)',
            t,t || '_staging',key_match) using p_run_id;
        get diagnostics removed = row_count;
        publication := publication || jsonb_build_object(t,jsonb_build_object('inserted',inserted,'updated',changed,'deleted',removed,
            'elapsed_ms',round(extract(epoch from clock_timestamp()-step_started)*1000)));
        expected := case t when 'charging_stations' then r.station_count when 'state_level_data' then r.state_count
            when 'county_level_data' then r.county_count else r.zip_count end;
        execute format('select count(*) from public.%I',t) into actual;
        if actual<>expected then raise exception 'Published snapshot count mismatch for %',t; end if;
    end loop;
    update public.station_refresh_runs set status='published',error=null,completed_at=clock_timestamp(),
        diagnostics=diagnostics || jsonb_build_object('publication',publication)
        where id=p_run_id returning * into r;
    return to_jsonb(r);
end $$;

-- Replacing functions retains existing ACLs; make the backend-only boundary explicit.
revoke all on function public.claim_station_refresh(uuid,uuid),public.publish_station_refresh(uuid) from public,anon,authenticated;
grant execute on function public.claim_station_refresh(uuid,uuid),public.publish_station_refresh(uuid) to service_role;
notify pgrst, 'reload schema';
