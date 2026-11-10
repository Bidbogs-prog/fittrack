-- Performance audit #10b/c.
--
-- b) The "admins read open requesters" policies called a security-definer
--    function per row, for every user's diary/weight/foods query. They now
--    start with (select public.is_admin()), which Postgres evaluates once per
--    query (an InitPlan): false for normal users, so the per-row requester
--    check never runs for them.
-- c) ai_spend_today() sums today's rows across all users: index by time.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles: admins read open requesters" on public.profiles;
create policy "profiles: admins read open requesters" on public.profiles
  for select to authenticated using ((select public.is_admin()) and public.admin_can_view_requester(id));

drop policy if exists "diary: admins read open requesters" on public.diary_entries;
create policy "diary: admins read open requesters" on public.diary_entries
  for select to authenticated using ((select public.is_admin()) and public.admin_can_view_requester(user_id));

drop policy if exists "weight: admins read open requesters" on public.weight_logs;
create policy "weight: admins read open requesters" on public.weight_logs
  for select to authenticated using ((select public.is_admin()) and public.admin_can_view_requester(user_id));

drop policy if exists "exercise: admins read open requesters" on public.exercise_logs;
create policy "exercise: admins read open requesters" on public.exercise_logs
  for select to authenticated using ((select public.is_admin()) and public.admin_can_view_requester(user_id));

drop policy if exists "favorites: admins read open requesters" on public.favorite_foods;
create policy "favorites: admins read open requesters" on public.favorite_foods
  for select to authenticated using ((select public.is_admin()) and public.admin_can_view_requester(user_id));

drop policy if exists "foods: admins read open requesters' own foods" on public.foods;
create policy "foods: admins read open requesters' own foods" on public.foods
  for select to authenticated
  using (owner_id is not null and (select public.is_admin()) and public.admin_can_view_requester(owner_id));

create index if not exists ai_usage_created_idx on public.ai_usage (created_at);
