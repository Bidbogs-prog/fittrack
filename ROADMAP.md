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
- [x] `weight_logs` table (user_id, date, weight_kg, RLS: own rows) — `profiles.weight_kg` kept as "current weight" cache, refreshed by the log action
- [x] One-tap daily weight entry on the dashboard (`weight-card.tsx`, logs against the viewed date)
- [x] Smoothed trend line — EWMA in `src/lib/weight.ts` (alpha 0.3), sparkline on dashboard, full chart on `/history`
- [x] Keep `supabase/schema.sql` and `src/lib/types.ts` in sync (project convention)

*Why first: it's the retention loop (users return to see progress) AND the prerequisite for adaptive TDEE (P1.2).*

### 0.2 Kill logging friction
- [x] Recents / frequent foods / favorites surfaced before the search box (`/api/foods/suggestions` + shelves in `add-food-dialog.tsx`; `favorite_foods` table, star toggle)
- [x] `updateDiaryEntry` server action + edit-in-place UI (`entry-row.tsx`: tap any diary line to edit portion/meal/macros)
- [x] Copy meal / copy yesterday (`copyDiaryEntries`; per-meal + whole-day buttons on the dashboard)
- [x] Quick-add calories (snapshot entries: `quick_*` columns, macros optional, micros stay unknown)
- [x] Saved meals: snapshot one meal's entries as a named group (`saved_meals` + `saved_meal_items`, bookmark button on each meal header), re-applied in one tap from the food picker's "Saved meals" shelf

### 0.3 User-created foods & recipes
- [x] Relax `foods` RLS: `owner_id` column (null = global, set = private to owner); barcode uniqueness now global-only. Per-100 g convention kept.
- [x] Recipes: `recipes` + `recipe_items`, logged as one unit — macros snapshotted at log time (recipe edits/deletes never rewrite diary history), builder at `/recipes`
- [x] User food management UI (`/foods/new`, `/foods/[id]/edit`, "Your foods" filter)

### 0.4 Barcode scanner
- [x] Scan UI in the add-food dialog: `BarcodeDetector` API with lazy-imported `@zxing/browser` fallback (Safari)
- [x] Lookup against `foods.barcode` (`/api/foods/barcode`; a user's private food outranks a global row with the same code)
- [x] Miss path: "not found — create food?" prefills the barcode on `/foods/new`

*Cheap win: the data side already exists.*

### 0.5 History & charts
- [x] Chart library: none — custom static SVG components in `history/charts.tsx` (zero bundle cost, nothing animates so reduced-motion is moot)
- [x] `/history`: 30-day calories vs target, macro trends, 90-day weight trend (raw dots + EWMA), hover tooltips; History added to nav
- [x] Weekly summary view (4-week table: days logged, avg kcal/protein, adherence = within ±10% of target)

### 0.6 Trust basics
- [x] Forgot password / reset flow (`/forgot-password` → email link → `/reset-password`; anti-enumeration message)
- [x] Account deletion (self-service on `/account` via `delete_account()` security-definer RPC; cascades diary/weight/foods/recipes) + change password

---

## P1 — Differentiation

> Turn existing strengths into headline features.

### 1.1 AI logging (photo + natural language)
- [x] "Describe your meal" text entry → Gemini parses (`dashboard/ai-log.ts`) → items matched against the food DB via `rankFoods` with portion estimates → review UI (`ai-log-view.tsx`) in the add-food dialog
- [x] Photo logging: `generateJson` in `src/lib/gemini.ts` now takes an inline image; photos are downscaled client-side (1280 px JPEG) and server actions accept up to 4 MB (`next.config.ts`)
- [x] Always user-confirmable before saving: each item is a library match (macros derived per convention) or an AI-estimate quick-add snapshot, grams editable, nothing inserted until "Log"

### 1.2 Adaptive TDEE (MacroFactor's moat)
- [x] `src/lib/adaptive.ts`: TDEE ≈ avg intake − (Δ EWMA weight trend × 7700)/days over a 28-day window, with quality gates (≥5 weigh-ins spanning ≥14 days, ≥10 logged days, ≥50% coverage) and a 0.9–2.5×BMR clamp
- [x] Weekly auto-adjustment: window always ends the Sunday before the current week, so targets are stable within a week and refresh Mondays; the dashboard hero explains the numbers ("you averaged X kcal while trend weight moved Y kg")
- [x] Mifflin-St Jeor stays the cold-start default; `calcTargetsWithTdee` in `nutrition.ts` reuses the same macro/floor rules. Dashboard, history and the AI coach all read `getActiveTargets`

### 1.3 AI coach v2
- [x] Persist insights: `ai_insights` table (user + scope day/week + period_start, jsonb payload, RLS own rows); day insights hydrate the dashboard card on load
- [x] Weekly trend analysis: `history/report.ts` reviews Mon–Sun with day-by-day data, averages vs targets, previous-week comparison and weight trend
- [x] Weekly report on `/history` (`week-report.tsx`), on-demand + persisted; needs ≥3 logged days
- [x] "Not medical advice" disclaimer kept on both cards

### 1.4 Actionable plans
- [x] "Log this day to my diary" one-tap on plan pages (`plans/actions.ts` → `applyPlanToDiary`, redirects to the dashboard)
- [x] AI-generated meal plans (`generateAiPlan`): composed strictly from real food ids (seed library + own foods + favorites), grams ground-truthed via `nutrition.ts` and scaled onto the kcal target; saved as private plans (`meal_plans.owner_id`, RLS split global/own)

### 1.5 Engagement mechanics
- [x] Real streaks + 30-day consistency (`src/lib/streak.ts`, habit strip on the dashboard) — an unlogged today doesn't break yesterday's run
- [x] Water tracking: `water_logs` table, one-tap ±250 ml glasses, target ~35 ml/kg (`calcWaterTargetMl`)
- [x] Optional intermittent fasting window (`profiles.eating_window_start/end`, set on `/account`, live open/fasting chip on the dashboard; overnight windows wrap midnight)
- [x] No emojis; Phosphor icons only

### 1.6 Conversational AI coach (next differentiator — premium track) *(added 2026-08-13)*

> A chat coach that actually knows the user's data — goals, targets, adherence, weight trend, training frequency, habits — grounded in cited evidence, with hard safety rails. The flagship premium feature (pairs with 3.1). Ship order: A → C are blockers for any beta; D before opening it beyond testers; E when Stripe lands.

**A. Chat foundation**
- [x] `coach_conversations` + `coach_messages` tables (RLS own rows; jsonb payload column for citations/flags), migration `20260813200000_coach_chat.sql` + schema.sql + types.ts
- [x] `/coach` route in `(app)` + nav entry; chat UI with optimistic sends + pending state (streaming proper deferred to the gateway work in D); `sendCoachMessage` starts with the auth check like every other mutation
- [x] Context builder `src/lib/coach/context.ts`: compact snapshot reusing existing helpers — `getActiveTargets`, trailing-14-day adherence, `calcStreaks`, `weightTrend`/`trendDelta`, exercise frequency, fasting window, units. Summarized, never a raw diary dump
- [x] Rolling conversation memory: `coach_conversations.summary` refreshed every few turns past 20 messages; prompt = summary + last 12 turns verbatim

**B. Evidence knowledge base**
- [x] Curated briefs in-repo (`src/lib/coach/evidence/*.ts` — TS constants instead of .md so no bundler/fs-tracing config): energy balance/CICO, protein & macro ranges, rates of change, refeeds & diet breaks, plateaus, hydration, micronutrient basics — each with inline citations (position stands / systematic reviews / trials) and a lastReviewed date
- [x] Retrieval: deterministic keyword router (`selectBriefs`, word-boundary for ASCII, substring for FR/AR terms, top 2 briefs into the prompt, used brief ids recorded on the message payload); pgvector RAG only if the corpus outgrows this
- [x] Briefs are PR-reviewed content, never model-generated at runtime; 6-month review cadence noted in `types.ts`, content contract enforced by vitest (id/keywords/date/Sources present)

**C. Safety rails (blockers, not polish)**
- [x] System prompt: not a doctor/dietitian; no diagnosis, treatment, medication or lab interpretation; direct to professionals for anything clinical; frames answers as general education applied to the user's logged data. Chat surface carries a persistent "not medical advice" notice (stronger than the current card disclaimer)
- [x] Deterministic risk flags computed from data before the model ever answers (`src/lib/coach/safety.ts` + vitest): BMI < 18.5, target at the 1200 kcal floor, sustained very-low logged intake (≥5 days averaging <1000 kcal), trend loss >1.5% bodyweight/week
- [x] Under-18s: coach is unavailable entirely — friendly explanation on `/coach`, re-checked server-side in the action. Decided over restricted mode: adolescent ED risk + liability outweigh the value, and a hard gate is testable
- [x] Restricted mode when flagged: no deficit/restriction advice, supportive tone, signpost to professional help; in-prompt refusal categories for ED-coded asks (extreme fasting, purging/compensation, hiding food, sub-floor calorie requests). Still to add: named region-aware (Morocco/France) helpline resources
- [ ] Red-team eval set: adversarial prompts (ED-coded, medical, jailbreak) with expected behaviors; deterministic checks under `npm test`, prompt behavior via a scripted eval run required before any prompt change ships
- [x] Guardrail-trigger analytics: PostHog `coach_guardrail_triggered` with the flag name only — no message content, no nutrition values, no PII (existing convention)

**D. LLM Gateway + cost control**
- [ ] `src/lib/llm.ts`: server-only OpenAI-compatible client pointed at LLM Gateway (`LLMGATEWAY_API_KEY`, `LLMGATEWAY_MODEL`); degrades to a friendly error without keys, same as `gemini.ts`
- [ ] Model policy: cheapest model that passes the eval set; tight max-tokens; prompt caching where the gateway supports it; model swappable by env without code changes. Start evals with the Gemini Flash family (already proven for the day-review coach) vs one Haiku-class alternate; the eval set decides, not vibes
- [ ] `ai_usage` metering table (user, feature, tokens in/out, estimated cost, day) + per-user daily message caps + global kill-switch env var
- [ ] Later: migrate insights/photo-log/plan generation onto `llm.ts` so `gemini.ts` stops being a second code path

**E. Premium wiring (with 3.1)**
- [ ] Server-side entitlement check on every coach action (UI gating is not security — same rule as admin)
- [ ] Client-pays loop: Stripe payment → tops up LLM Gateway credits; price set from real `ai_usage` cost data per active user + margin buffer
- [ ] Free taste: 10 coach messages/month on the free tier (assistant replies counted, monthly reset) — enough for 2–3 real exchanges at negligible token cost, and the reset creates a recurring upsell moment

*Why now: 1.1–1.4 built the data moat. This turns the one-shot day-review coach into the retention product — and it's the feature the market has shown users pay for (see Positioning).*

---

## P2 — Platform & reach

### 2.1 PWA
- [x] Manifest (`src/app/manifest.ts` + generated icons in `public/icons/`), service worker (`public/sw.js`: network-first pages with `/offline.html` fallback, cache-first static assets), registered in production by `sw-register.tsx` — installable on Android/desktop, apple-touch-icon for iOS
- [x] Offline diary queue: failed log actions (network throw) land in localStorage (`src/lib/offline-queue.ts`); `offline-sync.tsx` on the dashboard replays them through the same server actions when the connection returns, with a visible banner
- [ ] Push reminders: needs web-push infra outside this repo (VAPID keys, subscriptions table, scheduled sender — pair with a Supabase Edge Function cron)

### 2.2 Units & servings
- [x] Household serving sizes: `foods.serving_name/serving_grams` (nullable), editable on user foods, ½/1/2 shortcut chips in the portion picker — grams stay the source of truth
- [x] Imperial display option: `profiles.units` + `src/lib/units.ts`, account toggle; weight card (incl. lb input converted to kg), history chart/tiles and the adaptive explanation all convert at the display edge. Storage stays metric everywhere

### 2.3 i18n — French + Arabic (RTL) first
- [x] Infrastructure: next-intl (cookie locale, no URL restructure), `messages/{en,fr,ar}.json`, language switcher on `/account`, `html lang` + `dir=rtl` for Arabic
- [x] First translated surfaces: nav, login, forgot-password, account
- [ ] Remaining surfaces: signup/reset, dashboard, add-food dialog, foods, plans, history, onboarding (extract strings into the existing namespaces — pattern established)
- [ ] RTL layout audit (physical `pl-*`/`left-*` utilities need logical or `rtl:` variants once Arabic content is real)

### 2.4 Exercise & integrations
- [x] Manual workout logging (`exercise_logs`, activity card on the dashboard); burned kcal raises the day's target for formula targets only — adaptive TDEE already measures total burn, so no double credit. Exercise is also fed to the AI coach prompt
- [x] Steps: manual daily count (`step_logs`), informational
- [ ] Apple Health / Google Fit sync — needs the native wrapper (see 3.2); schedule together

### 2.5 Data export
- [x] CSV/JSON export of diary + weight history (`/api/export`, derived through the same diary helpers the UI uses), download cards on `/account`

---

## P3 — Business & scale

### 3.1 Monetization
- [ ] Free tier: logging, barcode, history (generous — beat MFP's paywalled barcode scan)
- [ ] Premium: conversational AI coach (1.6 — the headline), AI photo logging, adaptive TDEE, weekly AI reports (~where MFP $79.99/yr and MacroFactor $71.99/yr draw the line; LLM marginal cost maps to paid tier)
- [ ] Stripe + plan gating; payments fund LLM Gateway credits (see 1.6 D/E for metering and margin math)

### 3.2 Native apps
- [ ] Capacitor (or React Native) wrapper → App Store / Play Store presence, HealthKit/Google Fit access

### 3.3 Social & accountability
- [ ] Shared streaks / friends
- [ ] Coach–client sharing

### 3.4 Engineering debt (do before it bites)
- [x] Tests — vitest (`npm test`): nutrition (BMR/TDEE/targets/splits/portions/micros), adaptive TDEE (energy balance + quality gates + clamps), weight EWMA, streaks, units, diary helpers. 54 tests; extend when touching the math
- [x] Supabase migration files: `supabase/migrations/` with `20260809000000_baseline.sql` + config.toml; workflow (`supabase link` once, `db push` per change) documented in AGENTS.md and schema.sql. schema.sql stays the readable current-state reference
- [x] Error tracking + product analytics: Sentry (instrumentation.ts/-client.ts + global-error.tsx, needs `NEXT_PUBLIC_SENTRY_DSN`) and PostHog (`src/lib/analytics.ts`, needs `NEXT_PUBLIC_POSTHOG_KEY`); both no-op without keys. First product events: `diary_entry_logged`, `ai_meal_logged`, `weight_logged`, SPA pageviews

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
