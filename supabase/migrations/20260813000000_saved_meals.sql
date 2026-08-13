-- Saved meals: a named snapshot of one meal's diary rows that can be
-- re-applied to any day/meal in one tap (for repeated meals and ingredient
-- combinations). Items mirror the diary-entry payload: a food portion
-- (food_id + grams) or a macro snapshot (quick_name + quick_kcal, incl.
-- logged recipes, which keep recipe_id + servings for display).

create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_meals_user_idx
  on public.saved_meals (user_id, created_at desc);

alter table public.saved_meals enable row level security;

drop policy if exists "saved meals: read own" on public.saved_meals;
create policy "saved meals: read own" on public.saved_meals
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "saved meals: insert own" on public.saved_meals;
create policy "saved meals: insert own" on public.saved_meals
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "saved meals: update own" on public.saved_meals;
create policy "saved meals: update own" on public.saved_meals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "saved meals: delete own" on public.saved_meals;
create policy "saved meals: delete own" on public.saved_meals
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null references public.saved_meals (id) on delete cascade,
  food_id uuid references public.foods (id) on delete cascade,
  grams numeric(6, 1) check (grams > 0 and grams <= 5000),
  recipe_id uuid references public.recipes (id) on delete set null,
  servings numeric(5, 2) check (servings > 0 and servings <= 100),
  quick_name text,
  quick_kcal numeric(6, 1) check (quick_kcal >= 0),
  quick_protein_g numeric(6, 1) check (quick_protein_g >= 0),
  quick_carbs_g numeric(6, 1) check (quick_carbs_g >= 0),
  quick_fat_g numeric(6, 1) check (quick_fat_g >= 0),
  quick_fibre_g numeric(6, 1) check (quick_fibre_g >= 0),
  created_at timestamptz not null default now(),
  constraint saved_meal_item_shape check (
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
  )
);

create index if not exists saved_meal_items_meal_idx
  on public.saved_meal_items (saved_meal_id);

alter table public.saved_meal_items enable row level security;

drop policy if exists "saved meal items: own via meal" on public.saved_meal_items;
create policy "saved meal items: own via meal" on public.saved_meal_items
  for all to authenticated
  using (exists (
    select 1 from public.saved_meals m
    where m.id = saved_meal_id and m.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.saved_meals m
    where m.id = saved_meal_id and m.user_id = (select auth.uid())
  ));
