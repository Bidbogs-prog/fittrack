-- Reminders used Postgres' timezone data for the user's local clock, but it
-- disagreed with the user's phone for Africa/Casablanca (Postgres +01, device
-- +00), so reminders fired an hour early. The device now reports its own UTC
-- offset (on enabling, on saving times, and on app open when it changes), and
-- that offset wins over the zone name.

alter table public.reminder_settings
  add column if not exists utc_offset_min smallint check (utc_offset_min between -840 and 840);

create or replace function public.reminder_candidates()
returns table (
  user_id uuid, locale text, timezone text, breakfast time, lunch time, dinner time,
  local_date date, local_minutes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, s.locale, s.timezone, s.breakfast, s.lunch, s.dinner,
         lt.t::date,
         (extract(hour from lt.t) * 60 + extract(minute from lt.t))::integer
  from public.reminder_settings s
  cross join lateral (
    select case when exists (select 1 from pg_timezone_names where name = s.timezone) then s.timezone else 'Africa/Casablanca' end as name
  ) tz
  -- The device's own offset wins: it is the clock the user actually sees.
  cross join lateral (
    select case
      when s.utc_offset_min is not null then (now() at time zone 'UTC') + make_interval(mins => s.utc_offset_min)
      else now() at time zone tz.name
    end as t
  ) lt
  where s.enabled
    and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id);
$$;

revoke all on function public.reminder_candidates() from public, anon, authenticated;
grant execute on function public.reminder_candidates() to service_role;
