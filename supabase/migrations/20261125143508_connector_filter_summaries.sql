-- Additive storage for measured connector/speed capacity and disjoint site masks.
-- Backfill with scripts/backfill-filter-summaries.mjs before promoting the app.
do $$
declare t text;
begin
    if exists(select 1 from public.station_refresh_runs where status in ('fetching','staged','aggregating','ready')) then
        raise exception 'Finish the active station refresh before adding filter summaries';
    end if;
    foreach t in array array['state_level_data','county_level_data','zip_level_data',
        'state_level_data_staging','county_level_data_staging','zip_level_data_staging'] loop
        execute format('alter table public.%I add column if not exists filter_summary jsonb', t);
    end loop;
end $$;
notify pgrst, 'reload schema';
