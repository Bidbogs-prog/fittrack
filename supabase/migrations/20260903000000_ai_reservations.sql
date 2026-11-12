-- AUD-09: AI caps as atomic reservations instead of check-then-write.
-- reserve_ai_call takes a per-user/feature lock, counts finished calls plus
-- reservations still in flight (< 10 min old), and either refuses with the
-- cap that was hit or inserts a reservation. record_ai_usage fills the
-- caller's oldest open reservation with the real usage (or inserts a row
-- for uncapped features). A reservation whose call failed stops counting
-- after 10 minutes. Service role only.
alter table public.ai_usage
  add column if not exists status text not null default 'done' check (status in ('reserved', 'done'));

create index if not exists ai_usage_reserved_idx
  on public.ai_usage (user_id, feature, created_at) where status = 'reserved';

create or replace function public.reserve_ai_call(
  p_user uuid,
  p_feature text,
  p_daily integer,
  p_monthly integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  used_day integer;
  used_month integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_feature, 0));
  select
    count(*) filter (where created_at >= day_start),
    count(*)
  into used_day, used_month
  from public.ai_usage
  where user_id = p_user
    and feature = p_feature
    and created_at >= least(day_start, month_start)
    and (status = 'done' or created_at > now() - interval '10 minutes');
  if p_monthly is not null and used_month >= p_monthly then
    return 'monthly';
  end if;
  if p_daily is not null and used_day >= p_daily then
    return 'daily';
  end if;
  insert into public.ai_usage (user_id, feature, provider, model, status)
  values (p_user, p_feature, 'pending', 'pending', 'reserved');
  return 'ok';
end;
$$;

create or replace function public.record_ai_usage(
  p_user uuid,
  p_feature text,
  p_provider text,
  p_model text,
  p_input integer,
  p_cached integer,
  p_output integer,
  p_cost numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid bigint;
begin
  select id into rid
  from public.ai_usage
  where user_id = p_user and feature = p_feature and status = 'reserved'
    and created_at > now() - interval '10 minutes'
  order by created_at
  limit 1
  for update skip locked;
  if rid is null then
    insert into public.ai_usage (user_id, feature, provider, model, input_tokens, cached_tokens, output_tokens, cost_usd)
    values (p_user, p_feature, p_provider, p_model, p_input, p_cached, p_output, p_cost);
  else
    update public.ai_usage
    set provider = p_provider, model = p_model, input_tokens = p_input, cached_tokens = p_cached,
        output_tokens = p_output, cost_usd = p_cost, status = 'done'
    where id = rid;
  end if;
end;
$$;

revoke all on function public.reserve_ai_call(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_call(uuid, text, integer, integer) to service_role;
revoke all on function public.record_ai_usage(uuid, text, text, text, integer, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.record_ai_usage(uuid, text, text, text, integer, integer, integer, numeric) to service_role;
