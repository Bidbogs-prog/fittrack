-- Coach plan requests, v2: the admin gets the requester's brief (profile,
-- targets, recent eating, safety flags) and accepting a request opens a
-- DRAFT plan built for that person, sent only when the admin confirms.

-- Brief snapshotted at request time (admins have no RLS path into profiles,
-- and the brief should reflect what the coach saw when they built the plan).
alter table public.plan_requests
  add column if not exists snapshot jsonb
    check (snapshot is null or pg_column_size(snapshot) <= 20000);

-- Draft plans are visible to admins only, never in the global catalogue.
alter table public.meal_plans
  add column if not exists draft boolean not null default false;

drop policy if exists "plans: read for signed-in users" on public.meal_plans;
create policy "plans: read for signed-in users" on public.meal_plans
  for select to authenticated
  using (
    (owner_id is null and assigned_to is null and not draft)
    or owner_id = (select auth.uid())
    or (assigned_to = (select auth.uid()) and not draft)
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

drop policy if exists "plan items: read for signed-in users" on public.meal_plan_items;
create policy "plan items: read for signed-in users" on public.meal_plan_items
  for select to authenticated
  using (exists (
    select 1 from public.meal_plans p
    where p.id = plan_id
      and (
        (p.owner_id is null and p.assigned_to is null and not p.draft)
        or p.owner_id = (select auth.uid())
        or (p.assigned_to = (select auth.uid()) and not p.draft)
        or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
      )
  ));
