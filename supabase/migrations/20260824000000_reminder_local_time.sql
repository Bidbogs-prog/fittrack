-- The reminder sender resolves each user's local clock in Postgres rather
-- than the serverless runtime's Intl/tz data: a runtime with stale or
-- partial timezone data shifted Morocco by an hour (lunch at 13:00 sent at
-- 14:38 local). Service role only.

create or replace function public.reminder_candidates()
returns table (
  user_id uuid,
  locale text,
  timezone text,
  breakfast time,
  lunch time,
  dinner time,
  local_date date,
  local_minutes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, s.locale, s.timezone, s.breakfast, s.lunch, s.dinner,
         (now() at time zone tz.name)::date,
         (extract(hour from now() at time zone tz.name) * 60 + extract(minute from now() at time zone tz.name))::integer
  from public.reminder_settings s
  -- Unknown timezone names fall back to Morocco instead of erroring the whole run.
  cross join lateral (
    select case when exists (select 1 from pg_timezone_names where name = s.timezone) then s.timezone else 'Africa/Casablanca' end as name
  ) tz
  where s.enabled
    and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id);
$$;

revoke all on function public.reminder_candidates() from public, anon, authenticated;
grant execute on function public.reminder_candidates() to service_role;
