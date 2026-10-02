-- Premium entitlements (roadmap 1.6 E / 3.1): one row per premium user,
-- provider-agnostic so manual grants, Paddle, YouCan Pay or app-store
-- purchases all land in the same place. The app only ever asks
-- "is there an active, unexpired row?" (src/lib/entitlements.ts).
--
-- Grant premium by hand (SQL editor):
--   insert into public.entitlements (user_id, source, note)
--   select id, 'manual', 'beta tester' from auth.users where email = 'someone@example.com'
--   on conflict (user_id) do update set status = 'active', current_period_end = null, updated_at = now();
-- Revoke:
--   update public.entitlements set status = 'canceled', updated_at = now()
--   where user_id = (select id from auth.users where email = 'someone@example.com');

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'premium' check (plan in ('premium')),
  source text not null check (source in ('manual', 'paddle', 'youcanpay', 'apple', 'google')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'expired')),
  -- null = no end date (manual grants); otherwise access ends at this instant.
  current_period_end timestamptz,
  provider_customer_id text,
  provider_ref text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- Read-only for users. Rows are written by the service role (payment
-- webhooks) or by hand in the SQL editor — never from the client.
drop policy if exists "entitlements: read own" on public.entitlements;
create policy "entitlements: read own" on public.entitlements
  for select to authenticated
  using ((select auth.uid()) = user_id);
