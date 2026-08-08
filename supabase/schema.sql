-- ============================================================
-- FitTrack — full schema, RLS, storage
-- Idempotent: run the whole file in the Supabase SQL editor (or
-- psql) as often as needed — it creates from scratch and upgrades
-- existing databases in place.
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
  -- Custom macro split as percent of daily calories; all null = coach formula.
  protein_pct integer check (protein_pct between 5 and 80),
  carbs_pct integer check (carbs_pct between 5 and 80),
  fat_pct integer check (fat_pct between 5 and 80),
  constraint macro_split_sums_to_100 check (
    (protein_pct is null and carbs_pct is null and fat_pct is null)
    or protein_pct + carbs_pct + fat_pct = 100
  ),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional intermittent-fasting eating window (roadmap 1.5); both set or
-- both null. Times are local wall-clock; an overnight window (start >
-- end) is valid and wraps midnight.
alter table public.profiles
  add column if not exists eating_window_start time,
  add column if not exists eating_window_end time;

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles: update own" on public.profiles;
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
drop policy if exists "admins: read own row" on public.admins;
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

-- Extended nutritional profile (per 100 g). Null = unknown / not analysed —
-- the app treats null as "no data", never as zero. Defined via alter so this
-- file also upgrades databases created before these columns existed.
alter table public.foods
  add column if not exists saturated_fat_g numeric(7, 2) check (saturated_fat_g >= 0),
  add column if not exists trans_fat_g     numeric(7, 2) check (trans_fat_g >= 0),
  add column if not exists sugar_g         numeric(7, 2) check (sugar_g >= 0),
  add column if not exists cholesterol_mg  numeric(7, 2) check (cholesterol_mg >= 0),
  add column if not exists sodium_mg       numeric(7, 2) check (sodium_mg >= 0),
  add column if not exists potassium_mg    numeric(7, 2) check (potassium_mg >= 0),
  add column if not exists calcium_mg      numeric(7, 2) check (calcium_mg >= 0),
  add column if not exists iron_mg         numeric(7, 2) check (iron_mg >= 0),
  add column if not exists magnesium_mg    numeric(7, 2) check (magnesium_mg >= 0),
  add column if not exists zinc_mg         numeric(7, 2) check (zinc_mg >= 0),
  add column if not exists vitamin_a_ug    numeric(7, 2) check (vitamin_a_ug >= 0),
  add column if not exists vitamin_c_mg    numeric(7, 2) check (vitamin_c_mg >= 0),
  add column if not exists vitamin_d_ug    numeric(7, 2) check (vitamin_d_ug >= 0),
  add column if not exists vitamin_e_mg    numeric(7, 2) check (vitamin_e_mg >= 0),
  add column if not exists vitamin_k_ug    numeric(7, 2) check (vitamin_k_ug >= 0),
  add column if not exists thiamin_mg      numeric(7, 2) check (thiamin_mg >= 0),
  add column if not exists riboflavin_mg   numeric(7, 2) check (riboflavin_mg >= 0),
  add column if not exists niacin_mg       numeric(7, 2) check (niacin_mg >= 0),
  add column if not exists vitamin_b6_mg   numeric(7, 2) check (vitamin_b6_mg >= 0),
  add column if not exists folate_ug       numeric(7, 2) check (folate_ug >= 0),
  add column if not exists vitamin_b12_ug  numeric(7, 2) check (vitamin_b12_ug >= 0);

-- Provenance for imported foods. `barcode` is the natural dedup key for
-- Open Food Facts imports (and enables barcode scanning later); `source`
-- lets admins tell imported rows from hand-curated ones.
alter table public.foods
  add column if not exists barcode text,
  add column if not exists source text not null default 'manual';

alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods add constraint foods_source_check
  check (source in ('manual', 'off', 'usda'));

-- Users can create private foods: `owner_id` set = visible to that user
-- only, null = global (curated/imported). `created_by` stays provenance.
alter table public.foods
  add column if not exists owner_id uuid references auth.users (id) on delete cascade;

create index if not exists foods_owner_idx
  on public.foods (owner_id) where owner_id is not null;

-- Barcode dedup applies to the global library only — a private food may
-- repeat a barcode (e.g. a user's corrected copy of an imported product).
drop index if exists public.foods_barcode_key;
create unique index if not exists foods_barcode_key
  on public.foods (barcode) where owner_id is null;

-- Generic USDA staples carry no barcode — idempotency is by name instead.
create unique index if not exists foods_usda_name_key
  on public.foods (name) where source = 'usda';

alter table public.foods enable row level security;

drop policy if exists "foods: read for signed-in users" on public.foods;
drop policy if exists "foods: read global or own" on public.foods;
create policy "foods: read global or own" on public.foods
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

drop policy if exists "foods: admin insert" on public.foods;
create policy "foods: admin insert" on public.foods
  for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "foods: admin update" on public.foods;
create policy "foods: admin update" on public.foods
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "foods: admin delete" on public.foods;
create policy "foods: admin delete" on public.foods
  for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- Any signed-in user may manage their own private foods.
drop policy if exists "foods: insert own" on public.foods;
create policy "foods: insert own" on public.foods
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "foods: update own" on public.foods;
create policy "foods: update own" on public.foods
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "foods: delete own" on public.foods;
create policy "foods: delete own" on public.foods
  for delete to authenticated
  using (owner_id = (select auth.uid()));

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

drop policy if exists "diary: read own" on public.diary_entries;
create policy "diary: read own" on public.diary_entries
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "diary: insert own" on public.diary_entries;
create policy "diary: insert own" on public.diary_entries
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "diary: update own" on public.diary_entries;
create policy "diary: update own" on public.diary_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "diary: delete own" on public.diary_entries;
create policy "diary: delete own" on public.diary_entries
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- WEIGHT LOGS ----------
-- Source of truth for weight history; profiles.weight_kg stays as the
-- "current weight" cache (refreshed by the log-weight action).
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  log_date date not null default current_date,
  weight_kg numeric(5, 1) not null check (weight_kg between 25 and 400),
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists weight_logs_user_date_idx
  on public.weight_logs (user_id, log_date);

alter table public.weight_logs enable row level security;

drop policy if exists "weight: read own" on public.weight_logs;
create policy "weight: read own" on public.weight_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "weight: insert own" on public.weight_logs;
create policy "weight: insert own" on public.weight_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "weight: update own" on public.weight_logs;
create policy "weight: update own" on public.weight_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "weight: delete own" on public.weight_logs;
create policy "weight: delete own" on public.weight_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- WATER LOGS (roadmap 1.5) ----------
-- One row per user per day; the ml total is upserted by +glass taps.
create table if not exists public.water_logs (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  log_date date not null default current_date,
  ml integer not null default 0 check (ml between 0 and 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

alter table public.water_logs enable row level security;

drop policy if exists "water: read own" on public.water_logs;
create policy "water: read own" on public.water_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "water: insert own" on public.water_logs;
create policy "water: insert own" on public.water_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "water: update own" on public.water_logs;
create policy "water: update own" on public.water_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "water: delete own" on public.water_logs;
create policy "water: delete own" on public.water_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- FAVORITE FOODS ----------
create table if not exists public.favorite_foods (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

alter table public.favorite_foods enable row level security;

drop policy if exists "favorites: read own" on public.favorite_foods;
create policy "favorites: read own" on public.favorite_foods
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "favorites: insert own" on public.favorite_foods;
create policy "favorites: insert own" on public.favorite_foods
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "favorites: delete own" on public.favorite_foods;
create policy "favorites: delete own" on public.favorite_foods
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- AI INSIGHTS (persisted coach output, roadmap 1.3) ----------
-- One row per user + scope + period: scope 'day' keys on the diary date,
-- scope 'week' on the Monday of the analysed week. payload is the exact
-- JSON the UI renders (DayInsights / WeekReport in TypeScript); upserts
-- overwrite on regeneration.
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  scope text not null check (scope in ('day', 'week')),
  period_start date not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scope, period_start)
);

create index if not exists ai_insights_user_scope_idx
  on public.ai_insights (user_id, scope, period_start);

alter table public.ai_insights enable row level security;

drop policy if exists "ai_insights: read own" on public.ai_insights;
create policy "ai_insights: read own" on public.ai_insights
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "ai_insights: insert own" on public.ai_insights;
create policy "ai_insights: insert own" on public.ai_insights
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "ai_insights: update own" on public.ai_insights;
create policy "ai_insights: update own" on public.ai_insights
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "ai_insights: delete own" on public.ai_insights;
create policy "ai_insights: delete own" on public.ai_insights
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- RECIPES (multi-ingredient saved meals, per user) ----------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  description text,
  -- How many servings the full ingredient list makes.
  servings numeric(4, 1) not null default 1 check (servings > 0 and servings <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

drop policy if exists "recipes: read own" on public.recipes;
create policy "recipes: read own" on public.recipes
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "recipes: insert own" on public.recipes;
create policy "recipes: insert own" on public.recipes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "recipes: update own" on public.recipes;
create policy "recipes: update own" on public.recipes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "recipes: delete own" on public.recipes;
create policy "recipes: delete own" on public.recipes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  grams numeric(6, 1) not null check (grams > 0 and grams <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists recipe_items_recipe_idx on public.recipe_items (recipe_id);

alter table public.recipe_items enable row level security;

drop policy if exists "recipe items: own via recipe" on public.recipe_items;
create policy "recipe items: own via recipe" on public.recipe_items
  for all to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())
  ));

-- ---------- DIARY ENTRIES: quick-add + recipe snapshots ----------
-- An entry is either a food portion (food_id + grams) or a macro snapshot
-- (quick_name + quick_kcal): manual quick-adds and logged recipes. Recipe
-- entries snapshot their macros at log time — editing or deleting a recipe
-- never rewrites diary history — keeping recipe_id + servings for display.
alter table public.diary_entries
  alter column food_id drop not null,
  alter column grams drop not null;

alter table public.diary_entries
  add column if not exists recipe_id uuid references public.recipes (id) on delete set null,
  add column if not exists servings numeric(5, 2) check (servings > 0 and servings <= 100),
  add column if not exists quick_name text,
  add column if not exists quick_kcal numeric(6, 1) check (quick_kcal >= 0),
  add column if not exists quick_protein_g numeric(6, 1) check (quick_protein_g >= 0),
  add column if not exists quick_carbs_g numeric(6, 1) check (quick_carbs_g >= 0),
  add column if not exists quick_fat_g numeric(6, 1) check (quick_fat_g >= 0),
  add column if not exists quick_fibre_g numeric(6, 1) check (quick_fibre_g >= 0);

alter table public.diary_entries drop constraint if exists diary_entry_shape;
alter table public.diary_entries add constraint diary_entry_shape check (
  (
    food_id is not null and grams is not null
    and recipe_id is null and servings is null and quick_kcal is null
  )
  or (
    food_id is null and grams is null
    and quick_name is not null and quick_kcal is not null
    -- servings may outlive recipe_id (recipe deleted → set null).
    and (recipe_id is null or servings is not null)
  )
);

-- ---------- MEAL PLANS ----------
-- Admin-authored plans are global (owner_id null, readable by everyone);
-- AI-generated plans (roadmap 1.4) are private to their owner.
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  description text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.meal_plans
  add column if not exists owner_id uuid references auth.users (id) on delete cascade;

create index if not exists meal_plans_owner_idx
  on public.meal_plans (owner_id) where owner_id is not null;

alter table public.meal_plans enable row level security;

drop policy if exists "plans: read for signed-in users" on public.meal_plans;
create policy "plans: read for signed-in users" on public.meal_plans
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

drop policy if exists "plans: admin insert" on public.meal_plans;
drop policy if exists "plans: insert own or admin" on public.meal_plans;
create policy "plans: insert own or admin" on public.meal_plans
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    or (owner_id is null
        and exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  );

drop policy if exists "plans: admin update" on public.meal_plans;
drop policy if exists "plans: update own or admin" on public.meal_plans;
create policy "plans: update own or admin" on public.meal_plans
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  )
  with check (
    owner_id = (select auth.uid())
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

drop policy if exists "plans: admin delete" on public.meal_plans;
drop policy if exists "plans: delete own or admin" on public.meal_plans;
create policy "plans: delete own or admin" on public.meal_plans
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

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

drop policy if exists "plan items: read for signed-in users" on public.meal_plan_items;
create policy "plan items: read for signed-in users" on public.meal_plan_items
  for select to authenticated
  using (exists (
    select 1 from public.meal_plans p
    where p.id = plan_id and (p.owner_id is null or p.owner_id = (select auth.uid()))
  ));

drop policy if exists "plan items: admin insert" on public.meal_plan_items;
drop policy if exists "plan items: insert own or admin" on public.meal_plan_items;
create policy "plan items: insert own or admin" on public.meal_plan_items
  for insert to authenticated
  with check (
    exists (select 1 from public.meal_plans p
            where p.id = plan_id and p.owner_id = (select auth.uid()))
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

drop policy if exists "plan items: admin update" on public.meal_plan_items;
drop policy if exists "plan items: update own or admin" on public.meal_plan_items;
create policy "plan items: update own or admin" on public.meal_plan_items
  for update to authenticated
  using (
    exists (select 1 from public.meal_plans p
            where p.id = plan_id and p.owner_id = (select auth.uid()))
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.meal_plans p
            where p.id = plan_id and p.owner_id = (select auth.uid()))
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

drop policy if exists "plan items: admin delete" on public.meal_plan_items;
drop policy if exists "plan items: delete own or admin" on public.meal_plan_items;
create policy "plan items: delete own or admin" on public.meal_plan_items
  for delete to authenticated
  using (
    exists (select 1 from public.meal_plans p
            where p.id = plan_id and p.owner_id = (select auth.uid()))
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

-- ---------- STORAGE: food images ----------
insert into storage.buckets (id, name, public)
values ('food-images', 'food-images', true)
on conflict (id) do nothing;

drop policy if exists "food images: public read" on storage.objects;
create policy "food images: public read" on storage.objects
  for select
  using (bucket_id = 'food-images');

drop policy if exists "food images: admin insert" on storage.objects;
create policy "food images: admin insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'food-images'
    and exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

drop policy if exists "food images: admin update" on storage.objects;
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

drop policy if exists "food images: admin delete" on storage.objects;
create policy "food images: admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'food-images'
    and exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

-- ---------- SEED: a starter food library ----------
-- Guarded per-name: manual rows have no unique constraint, so a bare
-- "on conflict do nothing" would duplicate them on re-runs.
insert into public.foods (name, category, kcal, protein_g, carbs_g, fat_g, fibre_g)
select v.name, v.category, v.kcal, v.protein_g, v.carbs_g, v.fat_g, v.fibre_g
from (values
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
) as v(name, category, kcal, protein_g, carbs_g, fat_g, fibre_g)
where not exists (
  select 1 from public.foods f
  where f.name = v.name and f.brand is null and f.owner_id is null
);

-- Extended-profile seed data (per 100 g, USDA-derived approximations).
-- coalesce() only fills blanks, so it never overwrites values an admin has
-- edited — safe to re-run, and it upgrades pre-existing seed rows too.
update public.foods f set
  saturated_fat_g = coalesce(f.saturated_fat_g, v.sat_g),
  trans_fat_g     = coalesce(f.trans_fat_g,     v.trans_g),
  sugar_g         = coalesce(f.sugar_g,         v.sugar_g),
  cholesterol_mg  = coalesce(f.cholesterol_mg,  v.chol_mg),
  sodium_mg       = coalesce(f.sodium_mg,       v.na_mg),
  potassium_mg    = coalesce(f.potassium_mg,    v.k_mg),
  calcium_mg      = coalesce(f.calcium_mg,      v.ca_mg),
  iron_mg         = coalesce(f.iron_mg,         v.fe_mg),
  magnesium_mg    = coalesce(f.magnesium_mg,    v.mg_mg),
  zinc_mg         = coalesce(f.zinc_mg,         v.zn_mg),
  vitamin_a_ug    = coalesce(f.vitamin_a_ug,    v.va_ug),
  vitamin_c_mg    = coalesce(f.vitamin_c_mg,    v.vc_mg),
  vitamin_d_ug    = coalesce(f.vitamin_d_ug,    v.vd_ug),
  vitamin_e_mg    = coalesce(f.vitamin_e_mg,    v.ve_mg),
  vitamin_k_ug    = coalesce(f.vitamin_k_ug,    v.vk_ug),
  thiamin_mg      = coalesce(f.thiamin_mg,      v.b1_mg),
  riboflavin_mg   = coalesce(f.riboflavin_mg,   v.b2_mg),
  niacin_mg       = coalesce(f.niacin_mg,       v.b3_mg),
  vitamin_b6_mg   = coalesce(f.vitamin_b6_mg,   v.b6_mg),
  folate_ug       = coalesce(f.folate_ug,       v.b9_ug),
  vitamin_b12_ug  = coalesce(f.vitamin_b12_ug,  v.b12_ug)
from (values
  --  name                     sat    trans  sugar  chol   na    k     ca    fe    mg    zn    vitA  vitC  vitD  vitE  vitK   b1    b2    b3    b6    b9   b12
  ('Chicken breast, raw',      0.60,  0.01,  0.00,   73,    45,  334,    5,  0.40,  28,  0.70,    9,  0.0,  0.10,  0.60,   0.0, 0.09, 0.16,  9.90, 0.80,   9, 0.21),
  ('Whole egg',                3.10,  0.04,  0.40,  372,   142,  138,   56,  1.80,  12,  1.30,  160,  0.0,  2.00,  1.10,   0.3, 0.04, 0.46,  0.10, 0.17,  47, 0.90),
  ('Salmon fillet, raw',       3.10,  0.00,  0.00,   55,    59,  363,    9,  0.30,  27,  0.40,   58,  3.9, 11.00,  3.60,   0.5, 0.21, 0.16,  8.70, 0.60,  26, 3.20),
  ('Lean beef mince 5%',       2.20,  0.30,  0.00,   62,    66,  346,   12,  2.40,  21,  4.60,    0,  0.0,  0.10,  0.40,   1.5, 0.05, 0.16,  5.40, 0.40,   6, 2.20),
  ('White rice, cooked',       0.10,  0.00,  0.10,    0,     1,   35,   10,  1.20,  12,  0.50,    0,  0.0,  0.00,  0.00,   0.0, 0.16, 0.01,  1.50, 0.09,  58, 0.00),
  ('Rolled oats, dry',         1.10,  0.00,  1.00,    0,     2,  429,   54,  4.70, 177,  4.00,    0,  0.0,  0.00,  0.40,   2.0, 0.76, 0.14,  1.10, 0.12,  56, 0.00),
  ('Sweet potato, raw',        0.00,  0.00,  4.20,    0,    55,  337,   30,  0.60,  25,  0.30,  709,  2.4,  0.00,  0.30,   1.8, 0.08, 0.06,  0.60, 0.21,  11, 0.00),
  ('Wholemeal bread',          0.60,  0.00,  4.30,    0,   450,  250,  107,  2.50,  76,  1.80,    0,  0.0,  0.00,  0.60,   7.8, 0.39, 0.17,  4.40, 0.21,  42, 0.00),
  ('Pasta, cooked',            0.20,  0.00,  0.60,    0,     1,   44,    7,  0.50,  18,  0.50,    0,  0.0,  0.00,  0.10,   0.0, 0.02, 0.02,  0.40, 0.05,   7, 0.00),
  ('Greek yogurt 5%',          3.20,  0.10,  4.00,   13,    35,  141,  111,  0.00,  11,  0.50,   63,  0.0,  0.10,  0.00,   0.0, 0.02, 0.28,  0.20, 0.06,  12, 0.75),
  ('Skyr',                     0.10,  0.00,  4.00,    3,    45,  150,  110,  0.10,  11,  0.60,    2,  0.0,  0.00,  0.00,   0.0, 0.04, 0.30,  0.20, 0.05,  12, 0.60),
  ('Semi-skimmed milk',        1.10,  0.10,  4.80,    7,    42,  156,  120,  0.00,  11,  0.40,   22,  0.0,  0.00,  0.00,   0.3, 0.04, 0.18,  0.10, 0.04,   5, 0.50),
  ('Banana',                   0.10,  0.00, 12.20,    0,     1,  358,    5,  0.30,  27,  0.20,    3,  8.7,  0.00,  0.10,   0.5, 0.03, 0.07,  0.70, 0.37,  20, 0.00),
  ('Blueberries',              0.00,  0.00, 10.00,    0,     1,   77,    6,  0.30,   6,  0.20,    3,  9.7,  0.00,  0.60,  19.3, 0.04, 0.04,  0.40, 0.05,   6, 0.00),
  ('Apple',                    0.00,  0.00, 10.40,    0,     1,  107,    6,  0.10,   5,  0.00,    3,  4.6,  0.00,  0.20,   2.2, 0.02, 0.03,  0.10, 0.04,   3, 0.00),
  ('Broccoli, raw',            0.00,  0.00,  1.70,    0,    33,  316,   47,  0.70,  21,  0.40,   31, 89.2,  0.00,  0.80, 101.6, 0.07, 0.12,  0.60, 0.18,  63, 0.00),
  ('Spinach, raw',             0.10,  0.00,  0.40,    0,    79,  558,   99,  2.70,  79,  0.50,  469, 28.1,  0.00,  2.00, 482.9, 0.08, 0.19,  0.70, 0.20, 194, 0.00),
  ('Avocado',                  2.10,  0.00,  0.70,    0,     7,  485,   12,  0.60,  29,  0.60,    7, 10.0,  0.00,  2.10,  21.0, 0.07, 0.13,  1.70, 0.26,  81, 0.00),
  ('Almonds',                  3.80,  0.00,  4.40,    0,     1,  733,  269,  3.70, 270,  3.10,    0,  0.0,  0.00, 25.60,   0.0, 0.21, 1.14,  3.60, 0.14,  44, 0.00),
  ('Peanut butter',           10.30,  0.00,  9.20,    0,   430,  564,   49,  1.70, 168,  2.70,    0,  0.0,  0.00,  9.10,   0.3, 0.15, 0.19, 13.10, 0.44,  87, 0.00),
  ('Olive oil',               13.80,  0.00,  0.00,    0,     2,    1,    1,  0.60,   0,  0.00,    0,  0.0,  0.00, 14.40,  60.2, 0.00, 0.00,  0.00, 0.00,   0, 0.00),
  ('Whey protein powder',      2.00,  0.00,  6.00,   50,   200,  400,  400,  1.00,  60,  1.00,    0,  0.0,  0.00,  0.00,   0.0, 0.10, 0.50,  0.50, 0.10,  10, 1.00)
) as v(name, sat_g, trans_g, sugar_g, chol_mg, na_mg, k_mg, ca_mg, fe_mg, mg_mg, zn_mg, va_ug, vc_mg, vd_ug, ve_mg, vk_ug, b1_mg, b2_mg, b3_mg, b6_mg, b9_ug, b12_ug)
where f.name = v.name and f.brand is null;

-- ---------- ACCOUNT DELETION (self-service, GDPR) ----------
-- Deleting the auth user cascades through profiles, diary entries, weight
-- logs, favorites, recipes and private foods via the FKs above.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ============================================================
-- MAKE YOURSELF ADMIN (run after you have signed up in the app):
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'waerusan@gmail.com';
-- ============================================================
