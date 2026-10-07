-- Premium coach (roadmap: premium value): long-term coach memory and the
-- Monday check-in. Both are own-rows only; neither stores raw diary data.

-- ---------- coach memory ----------
-- Durable facts the user has told the coach ("no pork", "training for a
-- 10k"). Extracted after coach replies for premium users; users can see
-- and delete every fact from /account.
create table if not exists public.coach_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  fact text not null check (char_length(fact) between 3 and 200),
  created_at timestamptz not null default now()
);

create index if not exists coach_memories_user_idx on public.coach_memories (user_id, created_at);

alter table public.coach_memories enable row level security;

drop policy if exists "coach memories: read own" on public.coach_memories;
create policy "coach memories: read own" on public.coach_memories
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "coach memories: insert own" on public.coach_memories;
create policy "coach memories: insert own" on public.coach_memories
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "coach memories: delete own" on public.coach_memories;
create policy "coach memories: delete own" on public.coach_memories
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- weekly check-in ----------
-- One coach-written check-in per user per week (keyed on the Monday).
-- `targets` snapshots that week's active targets so next week's check-in
-- can explain what changed.
create table if not exists public.coach_checkins (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  week_start date not null,
  payload jsonb not null,
  targets jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.coach_checkins enable row level security;

drop policy if exists "coach checkins: read own" on public.coach_checkins;
create policy "coach checkins: read own" on public.coach_checkins
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "coach checkins: insert own" on public.coach_checkins;
create policy "coach checkins: insert own" on public.coach_checkins
  for insert to authenticated with check ((select auth.uid()) = user_id);
