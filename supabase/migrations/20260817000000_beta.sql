-- Invite-gated beta (roadmap GTM G1/G2): waitlist, invite codes, beta
-- access, founding-member premium, intent fake doors, global AI spend.
--
-- Access lives in its own table (not on profiles) because users may update
-- their own profile row; every write here goes through security-definer
-- functions that validate the code or waitlist status first.

-- ---------- intent fake doors (harmless if users set them themselves) ----------
alter table public.profiles
  add column if not exists premium_intent_at timestamptz,
  add column if not exists native_intent_at timestamptz,
  add column if not exists native_intent_os text check (native_intent_os in ('ios', 'android', 'other'));

-- ---------- beta access ----------
create table if not exists public.beta_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  via text not null check (via in ('grandfathered', 'invite', 'waitlist', 'manual')),
  invite_code text,
  -- First-touch attribution: utm_*, ref, landing path. Never PII.
  source jsonb
);

alter table public.beta_access enable row level security;

drop policy if exists "beta access: read own" on public.beta_access;
create policy "beta access: read own" on public.beta_access
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "beta access: admins read" on public.beta_access;
create policy "beta access: admins read" on public.beta_access
  for select to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- Everyone who already has an account keeps access.
insert into public.beta_access (user_id, granted_at, via)
select id, created_at, 'grandfathered' from public.profiles
on conflict (user_id) do nothing;

-- ---------- invite codes ----------
create table if not exists public.invite_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{4,32}$'),
  label text check (char_length(label) <= 80),
  max_uses integer not null default 1 check (max_uses between 1 and 100000),
  uses integer not null default 0,
  premium_days integer not null default 90 check (premium_days between 0 and 3650),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

drop policy if exists "invite codes: admins manage" on public.invite_codes;
create policy "invite codes: admins manage" on public.invite_codes
  for all to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- ---------- waitlist ----------
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  locale text check (char_length(locale) <= 10),
  city text check (char_length(city) <= 80),
  phone_os text check (phone_os in ('ios', 'android', 'other')),
  health_app text check (char_length(health_app) <= 40),
  referral_code text not null unique,
  referred_by text,
  source jsonb,
  status text not null default 'waiting' check (status in ('waiting', 'admitted', 'joined')),
  admitted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_email_idx on public.waitlist (lower(email));
create index if not exists waitlist_referred_by_idx on public.waitlist (referred_by);

alter table public.waitlist enable row level security;

-- No insert/select for the public: joining goes through join_waitlist().
drop policy if exists "waitlist: admins read" on public.waitlist;
create policy "waitlist: admins read" on public.waitlist
  for select to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "waitlist: admins update" on public.waitlist;
create policy "waitlist: admins update" on public.waitlist
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- Queue order: more confirmed referrals first, then earliest signup.
create or replace function public.waitlist_position(p_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select w.id, w.created_at,
      (select count(*) from public.waitlist r where r.referred_by = w.referral_code) as refs
    from public.waitlist w
    where w.status = 'waiting'
  ),
  me as (select * from scored where id = p_id)
  select case when not exists (select 1 from me) then 0 else (
    select count(*)::integer + 1 from scored s, me
    where s.id <> me.id and (s.refs > me.refs or (s.refs = me.refs and s.created_at < me.created_at))
  ) end;
$$;

revoke all on function public.waitlist_position(uuid) from public;

create or replace function public.join_waitlist(
  p_email text,
  p_locale text,
  p_city text,
  p_phone_os text,
  p_health_app text,
  p_referred_by text,
  p_source jsonb
)
returns table (referral_code text, queue_position integer, already boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_email text := lower(trim(p_email));
  v_row public.waitlist;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;

  select * into v_row from public.waitlist w where lower(w.email) = v_email;
  if found then
    return query select v_row.referral_code, public.waitlist_position(v_row.id), true;
    return;
  end if;

  insert into public.waitlist (email, locale, city, phone_os, health_app, referral_code, referred_by, source)
  values (
    v_email,
    left(p_locale, 10),
    nullif(left(trim(p_city), 80), ''),
    case when p_phone_os in ('ios', 'android', 'other') then p_phone_os end,
    nullif(left(trim(p_health_app), 40), ''),
    upper(substr(md5(gen_random_uuid()::text), 1, 8)),
    case when exists (select 1 from public.waitlist r where r.referral_code = upper(p_referred_by))
      then upper(p_referred_by) end,
    case when pg_column_size(p_source) <= 2000 then p_source end
  )
  returning * into v_row;

  return query select v_row.referral_code, public.waitlist_position(v_row.id), false;
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.join_waitlist(text, text, text, text, text, text, jsonb) to anon, authenticated;

-- Grant access (+ founding-member premium) to the calling user. Internal.
create or replace function public.grant_beta_access(
  p_user uuid,
  p_via text,
  p_code text,
  p_source jsonb,
  p_premium_days integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.beta_access (user_id, via, invite_code, source)
  values (p_user, p_via, p_code, case when pg_column_size(p_source) <= 2000 then p_source end)
  on conflict (user_id) do nothing;

  if p_premium_days > 0 then
    insert into public.entitlements as e (user_id, source, status, current_period_end, note)
    values (p_user, 'manual', 'active', now() + make_interval(days => p_premium_days),
            'founding member' || coalesce(' · ' || p_code, ''))
    on conflict (user_id) do update set
      status = 'active',
      current_period_end = case
        when e.status = 'active'
          and (e.current_period_end is null or e.current_period_end > excluded.current_period_end)
        then e.current_period_end
        else excluded.current_period_end
      end,
      updated_at = now();
  end if;

  update public.waitlist set status = 'joined'
  where lower(email) = (select lower(u.email) from auth.users u where u.id = p_user)
    and status <> 'joined';
end;
$$;

revoke all on function public.grant_beta_access(uuid, text, text, jsonb, integer) from public, anon, authenticated;

create or replace function public.redeem_invite(p_code text, p_source jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code public.invite_codes;
begin
  if v_user is null then return 'auth'; end if;
  if exists (select 1 from public.beta_access b where b.user_id = v_user) then return 'already'; end if;

  select * into v_code from public.invite_codes c where c.code = upper(trim(p_code)) for update;
  if not found then return 'invalid'; end if;
  if v_code.expires_at is not null and v_code.expires_at < now() then return 'expired'; end if;
  if v_code.uses >= v_code.max_uses then return 'full'; end if;

  update public.invite_codes set uses = uses + 1 where code = v_code.code;
  perform public.grant_beta_access(v_user, 'invite', v_code.code, p_source, v_code.premium_days);
  return 'ok';
end;
$$;

revoke all on function public.redeem_invite(text, jsonb) from public, anon;
grant execute on function public.redeem_invite(text, jsonb) to authenticated;

-- Admitted waitlist emails get in on their first visit, no code needed.
create or replace function public.claim_waitlist_access(p_source jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
begin
  if v_user is null then return false; end if;
  if exists (select 1 from public.beta_access b where b.user_id = v_user) then return true; end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_user and u.email_confirmed_at is not null;
  if v_email is null then return false; end if;
  if not exists (select 1 from public.waitlist w where lower(w.email) = v_email and w.status = 'admitted') then
    return false;
  end if;
  perform public.grant_beta_access(v_user, 'waitlist', null, p_source, 90);
  return true;
end;
$$;

revoke all on function public.claim_waitlist_access(jsonb) from public, anon;
grant execute on function public.claim_waitlist_access(jsonb) to authenticated;

-- Admin: admit the next N in queue order. Returns how many were admitted.
create or replace function public.admit_waitlist(p_count integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
    raise exception 'not_admin';
  end if;
  with next_up as (
    select w.id
    from public.waitlist w
    where w.status = 'waiting'
    order by (select count(*) from public.waitlist r where r.referred_by = w.referral_code) desc, w.created_at
    limit greatest(0, least(p_count, 1000))
  )
  update public.waitlist w set status = 'admitted', admitted_at = now()
  from next_up where w.id = next_up.id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.admit_waitlist(integer) from public, anon;
grant execute on function public.admit_waitlist(integer) to authenticated;

-- Global AI spend today (UTC) for the kill switch; aggregate only.
create or replace function public.ai_spend_today()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_usd), 0)
  from public.ai_usage
  where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;

revoke all on function public.ai_spend_today() from public, anon;
grant execute on function public.ai_spend_today() to authenticated;
