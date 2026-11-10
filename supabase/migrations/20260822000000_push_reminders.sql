-- Meal reminders over Web Push (roadmap GTM G3).
-- push_subscriptions: one row per device/browser the user allowed.
-- reminder_settings: per-user schedule, timezone and language.
-- reminder_log: one row per reminder sent (dedupe; written by the sender
-- with the service role only).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  endpoint text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push subscriptions: own" on public.push_subscriptions;
create policy "push subscriptions: own" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.reminder_settings (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  enabled boolean not null default true,
  timezone text not null default 'Africa/Casablanca' check (char_length(timezone) <= 64),
  locale text not null default 'en' check (locale in ('en', 'fr', 'ar-MA')),
  -- Local wall-clock times; null = no reminder for that meal.
  breakfast time default '09:00',
  lunch time default '13:30',
  dinner time default '20:30',
  updated_at timestamptz not null default now()
);

alter table public.reminder_settings enable row level security;

drop policy if exists "reminder settings: own" on public.reminder_settings;
create policy "reminder settings: own" on public.reminder_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  local_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, slot, local_date)
);

-- No policies: only the service role (cron sender) reads or writes it.
alter table public.reminder_log enable row level security;
