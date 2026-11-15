-- So3ra reference foods (food-data review P1): Moroccan home dishes
-- calculated from standard recipes (src/lib/reference). Shared rows with
-- source 'reference', a stable ref_key, search aliases, food state and the
-- calculation basis. ref_reviewed_at stays null until a dietitian signs off.
alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods add constraint foods_source_check
  check (source in ('manual', 'off', 'usda', 'reference'));

alter table public.foods
  add column if not exists ref_key text,
  add column if not exists aliases text check (char_length(aliases) <= 1000),
  add column if not exists state text check (state in ('dry', 'cooked', 'prepared', 'drink', 'packaged')),
  add column if not exists ref_basis text check (char_length(ref_basis) <= 1000),
  add column if not exists ref_reviewed_at timestamptz;

alter table public.foods drop constraint if exists foods_ref_key_key;
alter table public.foods add constraint foods_ref_key_key unique (ref_key);
