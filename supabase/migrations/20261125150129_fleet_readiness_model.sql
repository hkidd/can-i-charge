-- Additive metadata for a versioned fleet/provision model. Backfill and publish
-- reviewed scores atomically using scripts/rework-readiness.mjs.
do $$
declare t text;
begin
    if exists(select 1 from public.station_refresh_runs where status in ('fetching','staged','aggregating','ready')) then
        raise exception 'Finish the active station refresh before upgrading readiness';
    end if;
    foreach t in array array['state_level_data','county_level_data','zip_level_data',
        'state_level_data_staging','county_level_data_staging','zip_level_data_staging'] loop
        execute format('alter table public.%I add column if not exists demand_data jsonb', t);
        execute format('alter table public.%I add column if not exists public_supply jsonb', t);
    end loop;
end $$;
notify pgrst, 'reload schema';
