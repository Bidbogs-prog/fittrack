# FitTrack Roadmap

Goal: make FitTrack competitive with the best nutrition apps on the market (MyFitnessPal, Cronometer, MacroFactor, Yazio, and the AI-first trackers like Cal AI).

This is a living document. Check items off as they ship, add notes/links to PRs, and re-prioritize freely. Compiled 2026-08-07 from a full codebase audit + market research.

## Current position (as of 2026-08-07)

**Strengths to protect:**
- Precise gram-based logging, 21 tracked micronutrients (deeper than MyFitnessPal free tier)
- Clean nutrition math in `src/lib/nutrition.ts` (Mifflin-St Jeor → TDEE → goal targets, custom macro splits)
- Curated Morocco OFF + USDA food DB with quality gates (`scripts/import-off.ts`, `scripts/import-usda.ts`)
- Genuinely good Gemini day-review coach (`src/lib/gemini.ts`, dietitian prompt)
- Solid security posture (RLS everywhere, server-side re-verification), polished mobile-web UX

**Core weakness:** it's a single-day diary with no memory — no weight history, no trends, no charts, high logging friction, web-only.

**Market facts driving priority order:**
- If logging takes >30s, adherence collapses within 60–90 days; 70% of users abandon nutrition apps within 2 weeks.
- The fastest-growing entrants (Cal AI et al.) won purely on AI-reduced logging friction.
- MacroFactor's moat (adaptive TDEE) is algorithmic, not capital-intensive — reachable once weight logs exist.

---

## P0 — Table stakes

> Nothing else matters until logging is fast and the app has memory.

### 0.1 Weight log + trend line
- [ ] `weight_logs` table (user_id, date, weight_kg, RLS: own rows) — replaces overwrite-only `profiles.weight_kg` as source of history (keep profile field as "current weight" cache or derive it)
- [ ] One-tap daily weight entry on the dashboard
- [ ] Smoothed trend line (e.g. exponentially weighted moving average) — raw daily weights are noise
- [ ] Keep `supabase/schema.sql` and `src/lib/types.ts` in sync (project convention)

*Why first: it's the retention loop (users return to see progress) AND the prerequisite for adaptive TDEE (P1.2).*

### 0.2 Kill logging friction
- [ ] Recents / frequent foods / favorites surfaced before the search box in `add-food-dialog.tsx`
- [ ] `updateDiaryEntry` server action + edit-in-place UI (today: delete + re-add only)
- [ ] Copy meal / copy yesterday
- [ ] Quick-add calories (log kcal/macros without picking a food)

### 0.3 User-created foods & recipes
- [ ] Relax `foods` RLS: users can create their own foods (`created_by`, visible to self; admin foods stay global). Keep per-100g convention.
- [ ] Recipes: multi-ingredient saved meals (`recipes` + `recipe_items` tables), logged as one unit, macros derived via `nutrition.ts`
- [ ] User food management UI (create/edit under `/foods`)

### 0.4 Barcode scanner
- [ ] Scan UI in the add-food dialog: `BarcodeDetector` API with zxing-js fallback (Safari)
- [ ] Lookup against the already-populated `foods.barcode` column (OFF import)
- [ ] Miss path: "not found — create food?" (depends on 0.3)

*Cheap win: the data side already exists.*

### 0.5 History & charts
- [ ] Pick a chart library (none installed — keep bundle light; respect `prefers-reduced-motion`)
- [ ] `/history` (or dashboard tab): calorie + macro trends, weekly averages, weight trend
- [ ] Weekly summary view (avg vs target, adherence)

### 0.6 Trust basics
- [ ] Forgot password / reset flow (Supabase `resetPasswordForEmail`)
- [ ] Account deletion (self-service, cascades diary/weight/foods; GDPR)

---

## P1 — Differentiation

> Turn existing strengths into headline features.

### 1.1 AI logging (photo + natural language)
- [ ] "Describe your meal" text entry → Gemini parses → matches against own food DB with portion estimates → user confirms
- [ ] Photo logging: Gemini is multimodal; extend `src/lib/gemini.ts` (structured output like `insights.ts`)
- [ ] Always user-confirmable before saving (accuracy expectations: even MFP's Meal Scan is ~71%)

*Shortest path to a marquee feature — the pipeline and prompt discipline already exist.*

### 1.2 Adaptive TDEE (MacroFactor's moat)
- [ ] Derive actual TDEE from logged intake vs. weight trend (needs 0.1 + consistent logging)
- [ ] Weekly auto-adjustment of calorie/macro targets, with user-visible explanation
- [ ] Keep static Mifflin-St Jeor as the cold-start default in `nutrition.ts`; never duplicate the math elsewhere

### 1.3 AI coach v2
- [ ] Persist insights (`ai_insights` table keyed by user+date) — today they vanish on navigation
- [ ] Weekly trend analysis, not just single-day
- [ ] Auto-generated weekly report (with 0.5 data)
- [ ] Keep the "not medical advice" disclaimer (project rule)

### 1.4 Actionable plans
- [ ] "Apply plan to my diary" one-tap (plans are read-only reference today)
- [ ] AI-generated meal plans from user target + food preferences, using the real food DB

### 1.5 Engagement mechanics
- [ ] Real streaks + consistency score (landing page already advertises a fake "18-day streak")
- [ ] Water tracking
- [ ] Optional intermittent fasting windows (Yazio's wedge)
- [ ] No emojis in UI; Phosphor icons only (project rule)

---

## P2 — Platform & reach

### 2.1 PWA
- [ ] Manifest + service worker + installability
- [ ] Offline diary queue (log offline, sync later)
- [ ] Push reminders: meal-time nudges, streak protection, weigh-in reminder

### 2.2 Units & servings
- [ ] Household serving sizes ("1 cup", "1 medium egg") — grams stay the default and source of truth
- [ ] Imperial display option (lb, ft/in)

### 2.3 i18n — French + Arabic (RTL) first
- [ ] The food DB is Morocco-filtered (French/Arabic product names) while UI is English-only — fix the mismatch with the seed market
- [ ] RTL layout audit

### 2.4 Exercise & integrations
- [ ] Manual workout logging with calorie adjustment to the daily target
- [ ] Steps
- [ ] Apple Health / Google Fit sync — realistically needs the native wrapper (see 3.2); schedule together

### 2.5 Data export
- [ ] CSV/JSON export of diary + weight history (cheap; trust signal reviewers check)

---

## P3 — Business & scale

### 3.1 Monetization
- [ ] Free tier: logging, barcode, history (generous — beat MFP's paywalled barcode scan)
- [ ] Premium: AI photo logging, adaptive TDEE, weekly AI reports (~where MFP $79.99/yr and MacroFactor $71.99/yr draw the line; Gemini marginal cost maps to paid tier)
- [ ] Stripe + plan gating

### 3.2 Native apps
- [ ] Capacitor (or React Native) wrapper → App Store / Play Store presence, HealthKit/Google Fit access

### 3.3 Social & accountability
- [ ] Shared streaks / friends
- [ ] Coach–client sharing

### 3.4 Engineering debt (do before it bites)
- [ ] Tests — start with `src/lib/nutrition.ts` (it's the money math), then adaptive TDEE
- [ ] Supabase migration files (schema is applied by hand today; CLI already a devDependency)
- [ ] Error tracking + product analytics

---

## Positioning target

After P1, the story is: **"the AI coach that actually knows your data"** + **"adaptive targets like MacroFactor, on the web"** + best-in-class micronutrient depth at the free tier — with an underserved Morocco/Maghreb wedge (French/Arabic, local food DB) where MyFitnessPal's database is weak.

## Competitive reference (2026)

| Capability | MFP | Cronometer | MacroFactor | Yazio | Cal AI-style | FitTrack today |
|---|---|---|---|---|---|---|
| Barcode scan | ✅ premium | ✅ | ✅ | ✅ | ✅ | ❌ (data ready) |
| AI photo/voice/text log | ✅ | ❌ | ❌ | partial | ✅ core | ❌ |
| Weight trend + charts | ✅ | ✅ | ✅ best | ✅ | ✅ | ❌ |
| Adaptive TDEE | ❌ | partial | ✅ signature | ❌ | ❌ | ❌ |
| Custom foods/recipes | ✅ | ✅ | ✅ | ✅ +1,500 recipes | ✅ | ❌ |
| Recents/copy day | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Micronutrients | ~6 free | 80+ signature | ~30 | ~10 | few | **21 ✅** |
| Exercise/wearables | ✅ | ✅ | ✅ | ✅ | partial | ❌ |
| Fasting/water/streaks | ✅ | partial | ❌ | ✅ signature | ✅ streaks | ❌ |
| LLM day-review coach | generic | ❌ | ❌ | ❌ | basic | **✅ good** |
| Native app / offline | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ web-only |
