-- Re-score the existing snapshot; do not re-fetch or invent station capacity.
-- Complete regions retain their exact existing scores. Only regions whose
-- score was suppressed by missing capacity need the revised calculation.
do $$
declare t text;
begin
    if exists(select 1 from public.station_refresh_runs where status in ('fetching','staged','aggregating','ready')) then
        raise exception 'Finish the active station refresh before updating the scoring model';
    end if;
    foreach t in array array['state_level_data','county_level_data','zip_level_data',
        'state_level_data_staging','county_level_data_staging','zip_level_data_staging'] loop
        execute format($update$
            update public.%I set
                ev_infrastructure_score = case
                    when unknown_port_station_count > 0 then case
                        when population is null or population <= 0 or charger_count is null or charger_count <= 0
                            or unknown_port_station_count > charger_count
                            or (charger_count - unknown_port_station_count)::numeric < charger_count::numeric * 0.95
                            or level1_count is null or level1_count < 0
                            or level2_count is null or level2_count < 0
                            or dcfast_count is null or dcfast_count < 0
                            or level1_ports is null or level1_ports < 0
                            or level2_ports is null or level2_ports < 0
                            or dcfast_ports is null or dcfast_ports < 0
                            or tesla_count is null or tesla_count < 0
                            or ccs_count is null or ccs_count < 0 then null
                        else
                            round(least(50, (level1_ports::numeric * 0.3 + level2_ports::numeric * 0.7 + dcfast_ports) / population * 10000))
                            + case when level1_ports::numeric + level2_ports + dcfast_ports > 0
                                then round(least(15, dcfast_ports::numeric / (level1_ports::numeric + level2_ports + dcfast_ports) * 30)) else 0 end
                            + 5 * ((level1_ports > 0)::integer + (level2_ports > 0)::integer + (dcfast_ports > 0)::integer)
                            + case when level1_ports::numeric + level2_ports + dcfast_ports > 0
                                then 5 * ((tesla_count > 0)::integer + (ccs_count > 0)::integer) else 0 end
                            + round(least(10, (level1_ports::numeric + level2_ports + dcfast_ports) / (charger_count - unknown_port_station_count) * 2))
                        end
                    else ev_infrastructure_score
                end,
                scoring_version = 'regional-v3'
            where id is not null
        $update$, t);
    end loop;
end $$;
notify pgrst, 'reload schema';
