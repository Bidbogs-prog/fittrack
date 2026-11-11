-- Food review (user foods are shared only after admin approval):
-- review_status 'pending' = submitted, private to the owner until approved;
-- 'rejected' = stays private. Approval makes the row global (owner_id null).
alter table public.foods
  add column if not exists review_status text check (review_status in ('pending', 'rejected')),
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.foods drop constraint if exists foods_review_private;
alter table public.foods add constraint foods_review_private
  check (review_status is null or owner_id is not null);

create index if not exists foods_review_pending_idx
  on public.foods (created_at) where review_status = 'pending';

-- Users submit their foods for review but can never mark them reviewed
-- (rejected) or make them global; only admins approve.
drop policy if exists "foods: insert own" on public.foods;
create policy "foods: insert own" on public.foods
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (review_status is null or review_status = 'pending') and reviewed_by is null);

drop policy if exists "foods: update own" on public.foods;
create policy "foods: update own" on public.foods
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and (review_status is null or review_status = 'pending'));

drop policy if exists "foods: admins read the review queue" on public.foods;
create policy "foods: admins read the review queue" on public.foods
  for select to authenticated
  using (review_status is not null and (select public.is_admin()));

-- Existing user foods join the queue.
update public.foods set review_status = 'pending' where owner_id is not null and review_status is null;
