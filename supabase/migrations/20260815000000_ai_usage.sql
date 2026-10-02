-- AI metering (roadmap 1.6 D): one row per model call — tokens, model and
-- (when the provider reports it) cost. Drives per-user coach caps now and
-- pricing from real cost data later. No update/delete policies: users can't
-- erase their own rows to reset a cap. Never stores message content.

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  feature text not null check (char_length(feature) <= 40),
  provider text not null check (char_length(provider) <= 40),
  model text not null check (char_length(model) <= 120),
  input_tokens integer,
  cached_tokens integer,
  output_tokens integer,
  cost_usd numeric(12, 6),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_feature_idx
  on public.ai_usage (user_id, feature, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "ai usage: read own" on public.ai_usage;
create policy "ai usage: read own" on public.ai_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "ai usage: insert own" on public.ai_usage;
create policy "ai usage: insert own" on public.ai_usage
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
