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

## Architecture
- `src/lib/supabase/` — `client.ts` (browser), `server.ts` (RSC/actions), `proxy.ts` (session refresh). One client per request; protect pages with `supabase.auth.getClaims()`, never `getSession()` on the server.
- `src/lib/nutrition.ts` — single source of truth for BMR (Mifflin-St Jeor), TDEE activity multipliers, goal calorie/macro targets, and per-gram scaling of per-100g food facts. Never duplicate this math in components.
- `src/app/(auth)/` — login/signup + server actions; `src/app/auth/confirm/` — email OTP confirmation.
- `src/app/(app)/` — authenticated shell (onboarding, dashboard, foods, plans).
- `src/app/admin/` — admin-only (membership = row in `public.admins`). Every admin server action re-verifies membership server-side; UI gating alone is not security.
- `supabase/schema.sql` — full schema, RLS, storage policies, seed data. Apply in the Supabase SQL editor. Keep in sync with `src/lib/types.ts`.

## Conventions
- Data fetching in Server Components; mutations via server actions with `revalidatePath`. Every action starts with an auth check.
- Food facts are stored per 100 g; diary entries store `grams` only — macros are always derived via `src/lib/nutrition.ts`, never stored.
- Micronutrient columns (`MICRO_KEYS` in `src/lib/types.ts`) are nullable: null = unknown, never zero. Labels/units/daily values live in `MICRONUTRIENTS` in `src/lib/nutrition.ts`.
- Icons: `@phosphor-icons/react` only. No emojis in UI.
- Design tokens live in `src/app/globals.css` (Tailwind v4 `@theme`). Fonts: Outfit (display), Geist (body), Geist Mono (numerals). One accent (lime) on dark ink.

## Skills
Design skills from MengTo/Skills are installed in `.claude/skills/`: `frontend-design`, `design-taste-frontend`, `high-end-visual-design`, `tailwindcss`, `beautiful-shadows`, `animation-systems`, `landing-page`. Load the relevant one before UI work. For data-fetching/perf follow the `vercel-react-best-practices` skill; for anything Supabase, the `supabase` skill.
