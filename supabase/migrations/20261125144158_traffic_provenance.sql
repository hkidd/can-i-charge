-- Preserve historical traffic observations and their provenance in each snapshot.
do $$
declare t text;
begin
    if exists(select 1 from public.station_refresh_runs where status in ('fetching','staged','aggregating','ready')) then
        raise exception 'Finish the active station refresh before adding traffic provenance';
    end if;
    foreach t in array array['state_level_data','county_level_data','zip_level_data',
        'state_level_data_staging','county_level_data_staging','zip_level_data_staging'] loop
        execute format('alter table public.%I add column if not exists traffic_data jsonb', t);
    end loop;
end $$;
notify pgrst, 'reload schema';
