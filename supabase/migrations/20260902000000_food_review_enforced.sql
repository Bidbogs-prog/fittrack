-- AUD-05: review is enforced here, not only by the app. A signed-in
-- non-admin's own food is always pending after create or a change to its
-- facts, and reviewer fields are never theirs to set. Admins (approve /
-- reject) and the service role (imports) are untouched.
create or replace function public.foods_enforce_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ignored constant text[] := array['review_status', 'reviewed_by', 'reviewed_at', 'updated_at', 'created_at'];
begin
  if auth.uid() is null or public.is_admin() or new.owner_id is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.review_status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.review_status := case
    when (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored) then 'pending'
    else old.review_status
  end;
  return new;
end;
$$;

drop trigger if exists foods_enforce_review on public.foods;
create trigger foods_enforce_review
  before insert or update on public.foods
  for each row execute function public.foods_enforce_review();

-- The trigger now owns review_status/reviewer fields, so the policies only
-- check ownership (a rejected food stays editable; edits resubmit it).
drop policy if exists "foods: insert own" on public.foods;
create policy "foods: insert own" on public.foods
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "foods: update own" on public.foods;
create policy "foods: update own" on public.foods
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
