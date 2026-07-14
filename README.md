# FitTrack

A modern fitness tracker built with **Next.js 16 (App Router) + Tailwind v4 + Supabase**.

- **Auth** — email/password via Supabase Auth (`@supabase/ssr`, cookie sessions, `getClaims()` protection).
- **Onboarding** — first login collects sex, date of birth, height, weight, training frequency and goal; BMR (Mifflin-St Jeor) and TDEE (activity multiplier) are computed live and daily calorie/macro targets are locked in.
- **Diary** — log foods per meal (breakfast/lunch/dinner/snack) by grams; every macro is derived from per-100 g facts, so 137 g of rice is exactly 137 g of rice.
- **Admin console** (`/admin`) — add/edit foods with a photo (Supabase Storage) and per-100 g kcal/protein/carbs/fat/fibre; build goal-based meal plans from the library.
- **Meal plans** (`/plans`) — users browse coach-built days matching their goal, with day totals and "% of your target".

## Setup

### 1. Supabase project

1. Create a project at [database.new](https://database.new).
2. Open the **SQL editor** and run the whole of [`supabase/schema.sql`](supabase/schema.sql). This creates all tables, row-level security policies, the `food-images` storage bucket, and a seed food library.
3. (Recommended for local dev) In **Authentication → Sign In / Up → Email**, disable "Confirm email" so signups log in immediately. If you keep it on, the app handles confirmation links at `/auth/confirm`.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in both values from **Project Settings → API Keys**:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### 3. Run

```bash
npm install
npm run dev
```

Sign up at `http://localhost:3000/signup`, complete onboarding, and you land on the dashboard.

### 4. Make yourself admin

Run in the SQL editor (after signing up):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com';
```

Reload the app — an **Admin** item appears in the nav. Admin rights are enforced by RLS on the database, not just in the UI.

## How the math works

Everything lives in [`src/lib/nutrition.ts`](src/lib/nutrition.ts):

- **BMR** — Mifflin-St Jeor: `10·kg + 6.25·cm − 5·age (+5 male / −161 female)`
- **TDEE** — BMR × multiplier (sedentary 1.2 → athlete 1.9, chosen from gym frequency)
- **Target calories** — TDEE −500 (lose) / +0 (maintain) / +350 (gain), floored at 1200
- **Macros** — protein 1.8–2.2 g/kg by goal, fat 25% of calories, carbs the remainder, fibre 14 g/1000 kcal
- **Portions** — food facts are stored per 100 g; a portion of `g` grams is scaled by `g/100`

## Claude skills

`.claude/skills/` ships curated design skills from [MengTo/Skills](https://github.com/MengTo/Skills) (`frontend-design`, `design-taste-frontend`, `high-end-visual-design`, `tailwindcss`, `beautiful-shadows`, `animation-systems`, `landing-page`) so future UI work in Claude Code stays on the same design system. See `AGENTS.md` for project conventions.
