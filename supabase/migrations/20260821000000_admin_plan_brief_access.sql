-- Admins building a coach plan need the requester's profile, targets and
-- recent eating even when the request has no snapshot (sent before
-- 20260820000000) or the snapshot is stale. Read-only access, and only to
-- people with an OPEN plan request — it ends when the request is resolved.

create or replace function public.admin_can_view_requester(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
     and exists (select 1 from public.plan_requests r where r.user_id = p_user and r.status = 'pending');
$$;

revoke all on function public.admin_can_view_requester(uuid) from public, anon;
grant execute on function public.admin_can_view_requester(uuid) to authenticated;

drop policy if exists "profiles: admins read open requesters" on public.profiles;
create policy "profiles: admins read open requesters" on public.profiles
  for select to authenticated using (public.admin_can_view_requester(id));

drop policy if exists "diary: admins read open requesters" on public.diary_entries;
create policy "diary: admins read open requesters" on public.diary_entries
  for select to authenticated using (public.admin_can_view_requester(user_id));

drop policy if exists "weight: admins read open requesters" on public.weight_logs;
create policy "weight: admins read open requesters" on public.weight_logs
  for select to authenticated using (public.admin_can_view_requester(user_id));

drop policy if exists "exercise: admins read open requesters" on public.exercise_logs;
create policy "exercise: admins read open requesters" on public.exercise_logs
  for select to authenticated using (public.admin_can_view_requester(user_id));

drop policy if exists "favorites: admins read open requesters" on public.favorite_foods;
create policy "favorites: admins read open requesters" on public.favorite_foods
  for select to authenticated using (public.admin_can_view_requester(user_id));

drop policy if exists "foods: admins read open requesters' own foods" on public.foods;
create policy "foods: admins read open requesters' own foods" on public.foods
  for select to authenticated using (owner_id is not null and public.admin_can_view_requester(owner_id));
