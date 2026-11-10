-- First-run app tour: when the user finished or skipped it, so it shows
-- once per account (not per device). Users update their own profile row.
alter table public.profiles
  add column if not exists tour_completed_at timestamptz;
