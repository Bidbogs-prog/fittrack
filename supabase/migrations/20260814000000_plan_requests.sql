-- Coach plan assignment (admin → user). Users request a custom plan from
-- /plans; requests land in the admin panel, where an admin-built plan can
-- be assigned to the requester. An assigned plan leaves the global
-- catalogue and becomes visible only to its assignee (and admins). The
-- request row snapshots requester identity (email/name/goal) so admins
-- never need RLS access to profiles.

-- ---------- ASSIGNMENT ----------
alter table public.meal_plans
  add column if not exists assigned_to uuid references auth.users (id) on delete cascade;

create index if not exists meal_plans_assigned_idx
  on public.meal_plans (assigned_to) where assigned_to is not null;

drop policy if exists "plans: read for signed-in users" on public.meal_plans;
create policy "plans: read for signed-in users" on public.meal_plans
  for select to authenticated
  using (
    (owner_id is null and assigned_to is null)
    or owner_id = (select auth.uid())
    or assigned_to = (select auth.uid())
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

drop policy if exists "plan items: read for signed-in users" on public.meal_plan_items;
create policy "plan items: read for signed-in users" on public.meal_plan_items
  for select to authenticated
  using (exists (
    select 1 from public.meal_plans p
    where p.id = plan_id
      and (
        (p.owner_id is null and p.assigned_to is null)
        or p.owner_id = (select auth.uid())
        or p.assigned_to = (select auth.uid())
        or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
      )
  ));

-- ---------- PLAN REQUESTS ----------
create table if not exists public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- Requester identity snapshotted at request time: admins have no RLS
  -- path into profiles, and the request should survive profile edits.
  email text not null,
  full_name text,
  goal text check (goal in ('lose', 'maintain', 'gain')),
  note text,
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'dismissed')),
  plan_id uuid references public.meal_plans (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists plan_requests_user_idx
  on public.plan_requests (user_id, created_at desc);
create index if not exists plan_requests_status_idx
  on public.plan_requests (status, created_at desc);

alter table public.plan_requests enable row level security;

drop policy if exists "plan requests: read own or admin" on public.plan_requests;
create policy "plan requests: read own or admin" on public.plan_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

drop policy if exists "plan requests: insert own" on public.plan_requests;
create policy "plan requests: insert own" on public.plan_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and plan_id is null
  );

drop policy if exists "plan requests: admin update" on public.plan_requests;
create policy "plan requests: admin update" on public.plan_requests
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "plan requests: cancel own pending" on public.plan_requests;
create policy "plan requests: cancel own pending" on public.plan_requests
  for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');
