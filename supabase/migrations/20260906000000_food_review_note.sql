-- AUD-15: a rejection reason the creator can read. Like the other reviewer
-- fields, only admins write it.
alter table public.foods
  add column if not exists review_note text check (char_length(review_note) <= 300);

create or replace function public.foods_enforce_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ignored constant text[] := array['review_status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at', 'created_at'];
begin
  if auth.uid() is null or public.is_admin() or new.owner_id is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.review_status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := null;
    return new;
  end if;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.review_note := old.review_note;
  new.review_status := case
    when (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored) then 'pending'
    else old.review_status
  end;
  return new;
end;
$$;
