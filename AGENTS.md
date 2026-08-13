<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# FitTrack — Agent Guide

Next.js 16 (App Router, `src/`, `proxy.ts` not `middleware.ts`, `params`/`searchParams`/`cookies()` are async) + Tailwind v4 + Supabase (auth, Postgres, storage). TypeScript strict.

## Commands
- `npm run dev` — dev server
- `npm run build` — production build (must stay green)
- `npm run lint` — eslint
- `npm test` — vitest (unit tests for the nutrition/adaptive/diary math in `src/lib/*.test.ts`; must stay green, extend when touching that math)

## Architecture
- `src/lib/supabase/` — `client.ts` (browser), `server.ts` (RSC/actions), `proxy.ts` (session refresh). One client per request; protect pages with `supabase.auth.getClaims()`, never `getSession()` on the server.
- `src/lib/nutrition.ts` — single source of truth for BMR (Mifflin-St Jeor), TDEE activity multipliers, goal calorie/macro targets, and per-gram scaling of per-100g food facts. Never duplicate this math in components. Macro targets honour a per-user split (`profiles.protein_pct/carbs_pct/fat_pct`, percent of calories summing to 100, presets in `MACRO_PRESETS`); all-null means the default coach formula (protein g/kg, fat 25%, carbs remainder).
- `src/app/(auth)/` — login/signup + server actions; `src/app/auth/confirm/` — email OTP confirmation.
- `src/app/(app)/` — authenticated shell (onboarding, dashboard, foods, plans).
- `src/app/admin/` — admin-only (membership = row in `public.admins`). Every admin server action re-verifies membership server-side; UI gating alone is not security.
- `supabase/schema.sql` — full schema, RLS, storage policies, seed data; the readable current-state reference. Schema changes ship as NEW files in `supabase/migrations/` (timestamp-prefixed; applied with `npx supabase link` once, then `npx supabase db push`) AND update schema.sql + `src/lib/types.ts` in the same change. `20260809000000_baseline.sql` snapshots the pre-migration state; existing databases can mark it applied with `npx supabase migration repair --status applied 20260809000000` (it is idempotent, so re-running it is also safe).
- `src/lib/gemini.ts` — server-only Gemini REST helper (no SDK). AI insights on the dashboard (`src/app/(app)/dashboard/insights.ts` + `src/components/ai-insights.tsx`) use it with a dietitian system prompt.
- AI coach chat (roadmap 1.6): `src/app/(app)/coach/` (page, chat UI, `sendCoachMessage` action) on `generateText` in gemini.ts. Context from `src/lib/coach/context.ts` (compact snapshot, never raw diary); safety from `src/lib/coach/safety.ts` — deterministic flags decide restricted mode and the under-18 hard block BEFORE any model call, and both are enforced server-side. Keep the persistent not-medical-advice notice; extend `safety.test.ts` when touching thresholds. The system prompt lives in `src/lib/coach/prompt.ts` — before shipping ANY change to it, the evidence briefs, or the context format, run the red-team eval: `npm run eval:coach` (live Gemini API, needs `GEMINI_API_KEY`). Needs `GEMINI_API_KEY` in `.env.local` (optional `GEMINI_MODEL`, default `gemini-3.6-flash`); the UI degrades to a friendly error without it. Keep the "not medical advice" disclaimer.
- Observability (roadmap 3.4), all env-gated no-ops without keys: Sentry error tracking (`src/instrumentation.ts` server + `src/instrumentation-client.ts` + `app/global-error.tsx`; set `NEXT_PUBLIC_SENTRY_DSN`) and PostHog product analytics (`src/lib/analytics.ts` + `src/components/analytics.tsx`; set `NEXT_PUBLIC_POSTHOG_KEY`, optional `NEXT_PUBLIC_POSTHOG_HOST`). Track product moments via `track(event, props)` — never nutrition values or PII.
- `scripts/import-off.ts` — seeds `foods` from the Open Food Facts CSV export, filtered to Morocco (`npm run import:off`, `--dry-run` to preview). Needs `SUPABASE_SECRET_KEY` in `.env.local`. Imported rows carry `source = 'off'` and a `barcode`; re-runs skip existing barcodes so admin edits survive. OFF data is ODbL — keep attribution in the UI.

## Conventions
- Data fetching in Server Components; mutations via server actions with `revalidatePath`. Every action starts with an auth check.
- Food facts are stored per 100 g; diary entries store `grams` only — macros are always derived via `src/lib/nutrition.ts`, never stored.
- Micronutrient columns (`MICRO_KEYS` in `src/lib/types.ts`) are nullable: null = unknown, never zero. Labels/units/daily values live in `MICRONUTRIENTS` in `src/lib/nutrition.ts`.
- Icons: `@phosphor-icons/react` only. No emojis in UI.
- Design tokens live in `src/app/globals.css` (Tailwind v4 `@theme`). Fonts: Outfit (display), Geist (body), Geist Mono (numerals). One accent (lime) on dark ink.

## Skills
Design skills from MengTo/Skills are installed in `.claude/skills/`: `frontend-design`, `design-taste-frontend`, `high-end-visual-design`, `tailwindcss`, `beautiful-shadows`, `animation-systems`, `landing-page`. Load the relevant one before UI work. For data-fetching/perf follow the `vercel-react-best-practices` skill; for anything Supabase, the `supabase` skill.
