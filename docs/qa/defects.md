# Defect reports

Real defects found during development and the closed beta. Severity = impact on users; priority = urgency of the fix. Every entry has a fix and, where it can be automated, a regression test.

---

### DR-001 — Open redirect through the `next` parameter
- **Severity / priority:** High / High · **Type:** Security (CWE-601) · **Found by:** code review (static testing)
- **Where:** login, Google OAuth callback (`/auth/callback`), email confirmation (`/auth/confirm`), Google sign-in
- **Steps:** 1. Open `/login?next=/%09/evil.com` (or `/auth/callback?code=…&next=//evil.com` for the callback). 2. Sign in.
- **Expected:** stay on So3ra (`/dashboard`). **Actual:** redirected to `evil.com`. The prefix check (`startsWith("/") && !startsWith("//")`) let `/\t/evil.com` through; browsers strip the tab and read `//evil.com`.
- **Root cause:** each entry point had its own string-prefix check instead of resolving the URL.
- **Fix:** one shared `safeRedirectPath()` (`src/lib/redirect.ts`) that resolves against a fixed origin and compares origins; used by all four entry points. `/auth/confirm` was fixed first (`acf1ae0`); the rest in the QA iteration.
- **Regression test:** `src/lib/redirect.test.ts` (17 cases, EP).

### DR-002 — Microphone always blocked in the app
- **Severity / priority:** High / High · **Type:** Functional · **Found by:** exploratory testing on a phone (installed PWA)
- **Steps:** 1. Install the PWA. 2. Tap the mic on Today. **Expected:** permission prompt, voice logging works. **Actual:** "Couldn't hear that. Check microphone access", and no way to fix it in phone settings.
- **Root cause:** a security-header change set `Permissions-Policy: microphone=()`, which disables the mic for the whole site regardless of user permission.
- **Fix:** `microphone=(self)`; voice errors now distinguish "permission denied" from "not supported in installed app" (`7a221a6`).
- **Regression check:** header reviewed in the release checklist (candidate for an automated header test).

### DR-003 — Cookie banner and waitlist show raw translation keys
- **Severity / priority:** Medium / High · **Type:** Functional / i18n · **Found by:** exploratory testing in production (incognito)
- **Actual:** buttons read `consent.accept`, `consent.decline`, body `consent.body`. **Expected:** "Allow", "No thanks".
- **Root cause:** client components only receive message namespaces listed in `CLIENT_NAMESPACES`; the new `consent` and `waitlist` namespaces weren't listed. Unit tests and type checks couldn't see it — the keys existed on the server.
- **Fix:** namespaces added (`c76c267`).
- **Regression test:** `src/i18n/client-namespaces.test.ts` fails whenever a client component reads an unlisted namespace (verified failing before the fix).

### DR-004 — Google sign-in fails with "no registered origin"
- **Severity / priority:** High / High · **Type:** Functional / configuration · **Found by:** exploratory testing
- **Steps:** open a per-deployment Vercel URL (`so3ra-<hash>-….vercel.app/login`), tap Google. **Actual:** Google "Access blocked: Error 401 invalid_client — no registered origin".
- **Root cause:** Google Identity Services only works on registered JavaScript origins; every Vercel deploy has a new URL.
- **Fix:** the Google button is only used on the canonical site, configured origins and localhost; elsewhere the redirect flow is used (`c3fabc1`).

### DR-005 — General questions on Today fail with "Couldn't read any foods"
- **Severity / priority:** High / High · **Type:** Functional · **Found by:** beta user report
- **Steps:** on Today type "I feel tired lately". **Expected:** routed to the coach. **Actual:** meal parser error "Couldn't read any foods out of that".
- **Root cause:** routing relied on a question-word heuristic only; anything else was treated as a meal.
- **Fix:** the parser now returns an intent (`log` / `edit` / `chat`) and chats go to the coach; diary verbs override the heuristic (`5580ed9`, `fb8847e`).
- **Regression test:** `src/lib/intent-routing.test.ts` (partitions A–C).

### DR-006 — Logged exercise added to the calorie target (double counting)
- **Severity / priority:** High / Medium · **Type:** Requirement / domain defect · **Found by:** requirement review (product owner)
- **Expected:** the target already includes training through the activity multiplier ("Gym 3–5× a week" = ×1.55). **Actual:** each logged workout raised the day's target again, inflating the budget and hurting progress.
- **Validation:** checked against nutrition practice and comparable apps (MyFitnessPal adds exercise only because its activity level excludes exercise; MacroFactor never adds it; wearable burn estimates are often >25% off).
- **Fix:** exercise is informational only; UI copy explains why; day read told never to suggest eating back calories (`8185103`, `7b3e8db`).

### DR-007 — Day read warns about dietary cholesterol using a withdrawn limit
- **Severity / priority:** Medium / Medium · **Type:** Content / requirement · **Found by:** product review of AI output
- **Actual:** "Dietary cholesterol reached 639 mg, 213% of the upper limit … swap whole eggs for egg whites." **Expected:** no standalone cholesterol warning — the 300 mg limit was dropped from the US Dietary Guidelines in 2015.
- **Fix:** prompt rules prioritise calories, protein and fibre; no lone cholesterol flags or single-day micronutrient flags (`cffda52`).
- **Regression check:** live smoke run on an egg-heavy day produced no cholesterol warning (candidate case for the eval).

### DR-008 — Coach replies cut off and leak model reasoning
- **Severity / priority:** High / High · **Type:** Functional / AI · **Found by:** coach eval
- **Actual:** dinner-swap reply truncated mid-sentence and starting with "Drafting Response:**". **Root cause:** the thinking model spent the 1,536-token output budget on reasoning.
- **Fix:** reasoning effort `low` by default, budget raised to 4,096, server warning when a reply is truncated (`b4ec72c`). Eval 28/28 on repeated runs after the fix.

### DR-009 — French edit requests in the infinitive are sent to the coach
- **Severity / priority:** Medium / Medium · **Type:** Functional / i18n · **Found by:** equivalence-partitioning test design (QA iteration)
- **Steps:** on Today type "est-ce que tu peux supprimer le pain ?". **Expected:** diary edit sheet. **Actual:** routed to the coach as a question.
- **Root cause:** the verb list used word boundaries on stems (`supprime\b`), so *supprimer*, *enlever*, *ajouter* never matched.
- **Fix:** verb forms with inflections and Unicode-aware boundaries; English list tightened so "address" no longer matches "add".
- **Regression test:** `src/lib/intent-routing.test.ts`, partition C.

### DR-010 — Coach introduces itself with the old brand name
- **Severity / priority:** Low / Medium · **Type:** Content · **Found by:** static review of the system prompt
- **Actual:** "You are the FitTrack coach" while the product is So3ra. **Fix:** prompt updated (`b4ec72c`).

### DR-011 — Landing page fails WCAG AA contrast and has invalid list markup
- **Severity / priority:** Medium / Medium · **Type:** Non-functional (accessibility) · **Found by:** automated axe-core scan (`e2e/a11y.spec.ts`)
- **Actual:** 7 serious colour-contrast violations — muted text (`--paper-mute` #857a6a) at 4.41:1 on dark cards and food calories in the marquee at 1.78:1 (WCAG AA needs 4.5:1); and a `<dl>` in the "system" section containing a bare `<span>` between `<dt>` and `<dd>`, which breaks the list for screen readers.
- **Fix:** `--paper-mute` → #8f8472 (≥ 4.5:1 on every surface down to ink-800, barely visible change); marquee calories use the muted text colour; the macro bar moved inside its `<dd>`.
- **Regression test:** `e2e/a11y.spec.ts` fails on any serious or critical violation on /, /login, /signup, /privacy.

---

### OBS-1 — Free daily coach cap can never trigger with default settings
- **Found by:** BVA on `coachQuotaError` with both defaults (`src/lib/ai-usage.test.ts`).
- With the free monthly cap at 10 and the daily cap at 10, the monthly cap is always reached first, so the daily cap is dead configuration. Not a user-facing defect; decision for the product owner: lower the daily cap (e.g. 5) or drop it for free users.

### OBS-2 — Signed-out visits to /coach lose the return path
- **Found by:** code review while writing system tests.
- `/coach` and `/invite` aren't in the middleware's protected list, so a signed-out visitor is redirected to `/login` by the page itself, without `?next=/coach`; after logging in they land on the dashboard instead of the coach. Low impact; fix is one line (add them to `PROTECTED_PREFIXES`) — left for the product owner to schedule.
