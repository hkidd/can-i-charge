-- Apply to the existing API-key schema after rehearsing against its staging copy.
create table if not exists public.subscription_access (
    subscription_id text primary key,
    updated_at timestamptz not null,
    active boolean not null,
    api_key text,
    email_sent boolean not null default false
);
alter table public.subscription_access enable row level security;
revoke all on public.subscription_access from public, anon, authenticated, service_role;
alter table public.api_keys enable row level security;
revoke all on public.api_keys from public, anon, authenticated, service_role;
grant select on public.api_keys to service_role;

create or replace function public.apply_subscription_access(
    p_subscription_id text, p_updated_at timestamptz, p_active boolean,
    p_email text, p_customer_id text, p_new_api_key text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
set statement_timeout = '10s' set lock_timeout = '5s'
as $$
declare
    previous public.subscription_access;
    chosen_key text;
begin
    if p_subscription_id is null or p_updated_at is null or p_active is null then
        raise exception 'Subscription identity and timestamp are required';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(p_subscription_id, 0));
    select * into previous from public.subscription_access where subscription_id = p_subscription_id;
    -- Older events cannot undo a newer decision. Revocation wins timestamp ties.
    if previous.subscription_id is not null and
       (p_updated_at < previous.updated_at or
        (p_updated_at = previous.updated_at and not previous.active and p_active)) then
        return jsonb_build_object('api_key', null, 'send_email', false, 'stale', true);
    end if;

    chosen_key := previous.api_key;
    if chosen_key is null then
        select api_key into chosen_key from public.api_keys
        where polar_subscription_id::text = p_subscription_id
        order by created_at desc, api_key limit 1;
    end if;
    if p_active and chosen_key is null then
        if p_email is null or p_customer_id is null or p_new_api_key is null then
            raise exception 'Active subscriptions require customer and key details';
        end if;
        chosen_key := p_new_api_key;
        -- Populate provider IDs using their existing database column types.
        insert into public.api_keys(email,api_key,polar_customer_id,polar_subscription_id,status)
        select r.email,r.api_key,r.polar_customer_id,r.polar_subscription_id,r.status
        from jsonb_populate_record(null::public.api_keys, jsonb_build_object(
            'email',lower(p_email),'api_key',chosen_key,'polar_customer_id',p_customer_id,
            'polar_subscription_id',p_subscription_id,'status','active')) r;
    end if;

    update public.api_keys set status = 'revoked' where polar_subscription_id::text = p_subscription_id;
    if p_active then
        update public.api_keys set status = 'active',email = lower(p_email) where api_key = chosen_key;
    end if;
    insert into public.subscription_access(subscription_id,updated_at,active,api_key)
    values(p_subscription_id,p_updated_at,p_active,chosen_key)
    on conflict(subscription_id) do update set
        updated_at = excluded.updated_at, active = excluded.active, api_key = excluded.api_key;
    return jsonb_build_object('api_key',chosen_key,
        'send_email',p_active and not coalesce(previous.email_sent,false),'stale',false);
end;
$$;

create or replace function public.mark_subscription_email_sent(p_subscription_id text, p_api_key text)
returns void language sql security definer set search_path = pg_catalog, public
as $$
    update public.subscription_access set email_sent = true
    where subscription_id = p_subscription_id and api_key = p_api_key and active;
$$;

create or replace function public.consume_api_key(p_api_key text, p_day date)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
set statement_timeout = '5s'
as $$
declare used integer; customer_email text;
begin
    if p_day is null then raise exception 'Quota date is required'; end if;
    update public.api_keys set
        requests_today = case when last_request_date::text = p_day::text then coalesce(requests_today,0) + 1 else 1 end,
        last_request_date = p_day
    where api_key = p_api_key and status = 'active'
      and (last_request_date is null or last_request_date::text <> p_day::text or coalesce(requests_today,0) < 1000)
    returning requests_today,email into used,customer_email;
    if not found then
        return jsonb_build_object('valid',false,'remainingRequests',0,'reason',
            case when exists(select 1 from public.api_keys where api_key = p_api_key and status = 'active')
                 then 'quota' else 'invalid' end);
    end if;
    return jsonb_build_object('valid',true,'email',customer_email,'remainingRequests',1000-used);
end;
$$;

revoke all on function public.apply_subscription_access(text,timestamptz,boolean,text,text,text) from public, anon, authenticated;
revoke all on function public.mark_subscription_email_sent(text,text) from public, anon, authenticated;
revoke all on function public.consume_api_key(text,date) from public, anon, authenticated;
grant execute on function public.apply_subscription_access(text,timestamptz,boolean,text,text,text) to service_role;
grant execute on function public.mark_subscription_email_sent(text,text) to service_role;
grant execute on function public.consume_api_key(text,date) to service_role;

-- The old helper accepted caller-selected quota limits and is no longer used.
do $$
declare old_function record;
begin
    for old_function in
        select p.oid::regprocedure as signature from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'increment_api_requests'
    loop
        execute format('revoke all on function %s from public, anon, authenticated, service_role', old_function.signature);
    end loop;
end;
$$;
notify pgrst, 'reload schema';
