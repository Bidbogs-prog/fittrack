-- ============================================================
-- FitTrack — full schema, RLS, storage
-- Run this file once in the Supabase SQL editor (or psql).
-- ============================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  gender text check (gender in ('male', 'female')),
  birth_date date,
  height_cm numeric(5, 1) check (height_cm between 90 and 260),
  weight_kg numeric(5, 1) check (weight_kg between 25 and 400),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'athlete')),
  goal text check (goal in ('lose', 'maintain', 'gain')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: insert own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- ADMINS ----------
-- Membership table. Rows can only be added from the SQL editor / service
-- role (no insert/update/delete policies on purpose).
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Users may check their own membership (this also makes the
-- exists(...) predicates below work under RLS).
create policy "admins: read own row" on public.admins
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- FOODS (all facts per 100 g) ----------
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  category text not null default 'other'
    check (category in ('protein', 'carbs', 'dairy', 'fruit', 'vegetables', 'fats-nuts', 'snacks', 'drinks', 'other')),
  image_url text,
  kcal numeric(6, 1) not null check (kcal >= 0),
  protein_g numeric(5, 1) not null check (protein_g >= 0),
  carbs_g numeric(5, 1) not null check (carbs_g >= 0),
  fat_g numeric(5, 1) not null check (fat_g >= 0),
  fibre_g numeric(5, 1) not null default 0 check (fibre_g >= 0),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.foods enable row level security;

create policy "foods: read for signed-in users" on public.foods
  for select to authenticated
  using (true);

create policy "foods: admin insert" on public.foods
  for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "foods: admin update" on public.foods
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "foods: admin delete" on public.foods
  for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- ---------- DIARY ENTRIES ----------
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  entry_date date not null default current_date,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id uuid not null references public.foods (id) on delete cascade,
  grams numeric(6, 1) not null check (grams > 0 and grams <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists diary_entries_user_date_idx
  on public.diary_entries (user_id, entry_date);

alter table public.diary_entries enable row level security;

create policy "diary: read own" on public.diary_entries
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "diary: insert own" on public.diary_entries
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "diary: update own" on public.diary_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "diary: delete own" on public.diary_entries
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- MEAL PLANS (admin-authored, readable by everyone signed in) ----------
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  description text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.meal_plans enable row level security;

create policy "plans: read for signed-in users" on public.meal_plans
  for select to authenticated
  using (true);

create policy "plans: admin insert" on public.meal_plans
  for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "plans: admin update" on public.meal_plans
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "plans: admin delete" on public.meal_plans
  for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id uuid not null references public.foods (id) on delete cascade,
  grams numeric(6, 1) not null check (grams > 0 and grams <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists meal_plan_items_plan_idx on public.meal_plan_items (plan_id);

alter table public.meal_plan_items enable row level security;

create policy "plan items: read for signed-in users" on public.meal_plan_items
  for select to authenticated
  using (true);

create policy "plan items: admin insert" on public.meal_plan_items
  for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "plan items: admin update" on public.meal_plan_items
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "plan items: admin delete" on public.meal_plan_items
  for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- ---------- STORAGE: food images ----------
insert into storage.buckets (id, name, public)
values ('food-images', 'food-images', true)
on conflict (id) do nothing;

create policy "food images: public read" on storage.objects
  for select
  using (bucket_id = 'food-images');

create policy "food images: admin insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'food-images'
    and exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

create policy "food images: admin update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'food-images'
    and exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'food-images'
    and exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

create policy "food images: admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'food-images'
    and exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

-- ---------- SEED: a starter food library ----------
insert into public.foods (name, category, kcal, protein_g, carbs_g, fat_g, fibre_g) values
  ('Chicken breast, raw',        'protein',    120, 22.5,  0.0,  2.6, 0.0),
  ('Whole egg',                  'protein',    143, 12.6,  0.7,  9.5, 0.0),
  ('Salmon fillet, raw',         'protein',    208, 20.4,  0.0, 13.4, 0.0),
  ('Lean beef mince 5%',         'protein',    137, 21.0,  0.0,  5.0, 0.0),
  ('White rice, cooked',         'carbs',      130,  2.7, 28.2,  0.3, 0.4),
  ('Rolled oats, dry',           'carbs',      379, 13.2, 67.7,  6.5, 10.1),
  ('Sweet potato, raw',          'carbs',       86,  1.6, 20.1,  0.1, 3.0),
  ('Wholemeal bread',            'carbs',      247, 13.0, 41.0,  3.4, 7.0),
  ('Pasta, cooked',              'carbs',      158,  5.8, 30.9,  0.9, 1.8),
  ('Greek yogurt 5%',            'dairy',       97,  9.0,  3.9,  5.0, 0.0),
  ('Skyr',                       'dairy',       63, 11.0,  4.0,  0.2, 0.0),
  ('Semi-skimmed milk',          'dairy',       47,  3.4,  4.8,  1.8, 0.0),
  ('Banana',                     'fruit',       89,  1.1, 22.8,  0.3, 2.6),
  ('Blueberries',                'fruit',       57,  0.7, 14.5,  0.3, 2.4),
  ('Apple',                      'fruit',       52,  0.3, 13.8,  0.2, 2.4),
  ('Broccoli, raw',              'vegetables',  34,  2.8,  6.6,  0.4, 2.6),
  ('Spinach, raw',               'vegetables',  23,  2.9,  3.6,  0.4, 2.2),
  ('Avocado',                    'fats-nuts',  160,  2.0,  8.5, 14.7, 6.7),
  ('Almonds',                    'fats-nuts',  579, 21.2, 21.6, 49.9, 12.5),
  ('Peanut butter',              'fats-nuts',  588, 25.1, 20.0, 50.4, 6.0),
  ('Olive oil',                  'fats-nuts',  884,  0.0,  0.0,100.0, 0.0),
  ('Whey protein powder',        'protein',    400, 80.0, 10.0,  6.0, 0.0)
on conflict do nothing;

-- ============================================================
-- MAKE YOURSELF ADMIN (run after you have signed up in the app):
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'waerusan@gmail.com';
-- ============================================================
