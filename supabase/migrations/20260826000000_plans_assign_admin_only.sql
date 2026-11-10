-- Security audit #2: a user could create (or edit) their own plan with
-- assigned_to = someone else's id, and it showed on that person's Meal plans
-- tab as "From your coach". Only admins may assign; users' own plans are
-- never assigned.

drop policy if exists "plans: insert own or admin" on public.meal_plans;
create policy "plans: insert own or admin" on public.meal_plans
  for insert to authenticated
  with check (
    (owner_id = (select auth.uid()) and assigned_to is null)
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

drop policy if exists "plans: update own or admin" on public.meal_plans;
create policy "plans: update own or admin" on public.meal_plans
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  )
  with check (
    (owner_id = (select auth.uid()) and assigned_to is null)
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

-- Remove any assignment a non-admin made on their own plan.
update public.meal_plans p set assigned_to = null
where p.owner_id is not null and p.assigned_to is not null
  and not exists (select 1 from public.admins a where a.user_id = p.owner_id);
