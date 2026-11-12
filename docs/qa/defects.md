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
- **Resolved:** free daily default lowered to 5 (`18446fb`); `src/lib/ai-usage.test.ts` covers 4/5 used today with both defaults.

### OBS-2 — Signed-out visits to /coach lose the return path
- **Found by:** code review while writing system tests.
- `/coach` and `/invite` aren't in the middleware's protected list, so a signed-out visitor is redirected to `/login` by the page itself, without `?next=/coach`; after logging in they land on the dashboard instead of the coach. Low impact; fix is one line (add them to `PROTECTED_PREFIXES`) — left for the product owner to schedule.
- **Resolved:** added to `PROTECTED_PREFIXES` (`22d0cd2`); `e2e/public.spec.ts` checks `/history`, `/coach` and `/invite` redirect to `/login?next=…`.

### DR-012 — Invite codes don't grant Premium to existing users
- **Severity / priority:** High / High · **Type:** Functional · **Found by:** product owner (support case: a user given a 90-day code stayed on Free)
- **Steps:** 1. Account exists before the beta gate (or was admitted from the waitlist). 2. Open `/signup?code=X` for a code with Premium days. **Expected:** the code's Premium days are added. **Actual:** nothing happens and no error is shown.
- **Root cause (two parts):** (a) a signed-in user opening `/signup?code=X` was redirected to `/dashboard` with the query string dropped, so the code never reached the app; (b) `redeem_invite` returned `already` for anyone with beta access before even reading the code, so Premium days were never granted.
- **Fix:** migration `20260819000000_invite_redemptions.sql` — members can redeem codes for their Premium days, once per user per code (`invite_redemptions`, backfilled); codes with 0 Premium days don't burn a use for members. Signed-in visitors to `/signup?code=X` go to `/invite?code=X`; Me has a "Have an invite code?" link; members land on Me with a confirmation.
- **Regression tests:** `tests/db/beta-access.test.ts` → "invite codes for existing members (DR-012)" (5 cases); ST-5 updated (`used`).

---

## Security and performance audit (August 2026)

Found by a full code review (static testing); DR-013 to DR-015 were confirmed by running exploits against the real migrations in a throwaway database before fixing.

### DR-013 — Any user can switch off AI for everyone
- **Severity / priority:** Critical / High · **Type:** Security (CWE-639, abuse of trust) · **Found by:** code review, confirmed in a test database
- **Steps:** 1. Sign in. 2. With the public anon key, insert an `ai_usage` row for yourself with `cost_usd = 1000`. 3. Use any AI feature. **Expected:** only the server records usage. **Actual:** `ai_spend_today()` passes the platform cap and every AI feature answers "temporarily unavailable" for all users.
- **Root cause:** RLS let users insert their own usage rows (to make recording work from the request client), so the cost field was user-controlled; users could also call `ai_spend_today()`.
- **Fix:** migration `20260825000000_ai_usage_service_only.sql` drops the insert policy and revokes the function from `authenticated`; `recordAiUsage` and `aiSpendExceeded` use the service-role client (`05be38f`).
- **Regression tests:** `tests/db/rls.test.ts` → "a user can see their usage but cannot delete it to reset their caps"; `tests/db/zz-audit.test.ts`.

### DR-014 — Users can plant a "From your coach" plan in someone else's account
- **Severity / priority:** High / High · **Type:** Security (CWE-284) · **Found by:** code review, confirmed in a test database
- **Steps:** insert a `meal_plans` row with `assigned_to` = another user's id. **Expected:** rejected. **Actual:** the plan appears in the victim's Plans as sent by their coach (phishing / bad nutrition advice vector).
- **Root cause:** the insert policy checked `owner_id = auth.uid()` but not `assigned_to`.
- **Fix:** migration `20260826000000_plans_assign_admin_only.sql`: only admins may set `assigned_to`; existing user-made assignments cleared (`21ccd54`).
- **Regression tests:** `tests/db/plan-requests.test.ts` → "plan assignment is admin-only (audit #2)".

### DR-015 — `schema.sql` fails on a fresh database and undoes draft-plan protection
- **Severity / priority:** High / Medium · **Type:** Configuration / data integrity · **Found by:** code review, confirmed by running the file
- **Actual:** the plan-brief section ran before the tables it altered existed, and a later section re-created the old plan policy, so a database built from `schema.sql` let users read admin drafts. **Expected:** `schema.sql` equals the result of the migrations.
- **Root cause:** sections appended in feature order, not dependency order; nothing tested the file.
- **Fix:** sections reordered, policies aligned (`7b7b83a`).
- **Regression test:** `tests/db/schema.test.ts` builds both a fresh `schema.sql` database and a migrations database and compares tables, columns, policies and functions.

### DR-016 — Open redirect in the language switcher
- **Severity / priority:** Medium / High · **Type:** Security (CWE-601) · **Found by:** code review
- **Steps:** submit the locale form with `back=/\\evil.com`. **Actual:** redirected off-site. Same bug class as DR-001 in a place DR-001's fix missed.
- **Fix:** `setLocale` uses `safeRedirectPath` (`7cd787e`).
- **Regression test:** `src/lib/redirect.test.ts` also scans `src/` and fails if a hand-written `startsWith("/")` redirect check reappears.

### DR-017 — The invite-only beta doesn't apply to AI features
- **Severity / priority:** High / High · **Type:** Security / cost · **Found by:** code review
- **Actual:** a signed-up user without beta access could call the coach route and AI server actions directly (the gate was only on pages). **Expected:** no AI without beta access.
- **Fix:** `featureQuotaError` and `coachQuotaError` check `ensureBetaAccess`; the coach returns 403 `invite` with a translated message (`0626799`).
- **Regression test:** `src/lib/ai-usage.test.ts` (no-access case).

### DR-018 — Sign-out leaves cached pages and reminders on the device
- **Severity / priority:** Medium / Medium · **Type:** Security / privacy (shared device) · **Found by:** code review
- **Actual:** after sign-out, the service worker still served the previous user's cached pages offline and the device kept receiving their meal reminders.
- **Fix:** `SignOutForm` clears the service-worker caches and unsubscribes push before signing out; subscribing on a device already registered to another account takes it over (`c67cc01`).
- **Regression check:** manual (two accounts on one phone) — needs the signed-in E2E environment to automate.

### DR-019 — Invite codes can be brute-forced
- **Severity / priority:** Medium / Medium · **Type:** Security (CWE-307) · **Found by:** code review
- **Actual:** `redeem_invite` accepted unlimited guesses. **Fix:** migration `20260827000000_invite_attempt_limit.sql`: 10 unknown codes per user per hour, then `rate` ("Too many wrong codes") (`4a79609`).
- **Regression test:** `tests/db/beta-access.test.ts` → "invite guessing limit (audit #7)".

### DR-020 — CSV export can run formulas in Excel
- **Severity / priority:** Medium / Low · **Type:** Security (CWE-1236) · **Found by:** code review
- **Steps:** name a food `=HYPERLINK("http://evil","x")`, export, open in Excel. **Actual:** the formula runs.
- **Fix:** `csvCell` (`src/lib/csv.ts`) prefixes cells starting with `= + - @`, tab or CR with `'` (`2d64cb3`).
- **Regression test:** `src/lib/csv.test.ts`.

### DR-021 — Waitlist reveals other people's referral codes and position
- **Severity / priority:** Low / Medium · **Type:** Privacy (CWE-203) · **Found by:** code review
- **Steps:** join the waitlist with someone else's email. **Actual:** their referral code and queue position are shown (and the code could be used as theirs).
- **Fix:** migration `20260828000000_waitlist_no_lookup.sql`; an existing email only gets "already on the list" (`8b7062b`).
- **Regression test:** `tests/db/beta-access.test.ts` → "joining twice says 'already' without revealing the entry (audit #9a)".

### DR-022 — No Content-Security-Policy
- **Severity / priority:** Low / Low · **Type:** Security hardening · **Found by:** code review
- **Fix:** baseline CSP in `next.config.ts`: `frame-ancestors 'none'`, `base-uri 'self'`, `object-src 'none'`, `form-action 'self'` (`035f1b0`).
- **Regression test:** `e2e/public.spec.ts` security-headers check.

### DR-023 — An outside link can send a coach message as the user
- **Severity / priority:** Low / Medium · **Type:** Security (CSRF-like, CWE-352) · **Found by:** code review
- **Steps:** a signed-in user opens `/coach?c=new&q=…` from another site. **Actual:** the text is sent to the coach automatically (uses quota, plants text in memory).
- **Fix:** auto-send only when the referrer is the app; otherwise the text is shown as a suggested starter (`927e503`).
- **Regression check:** manual; candidate for the signed-in E2E suite.

### DR-024 — Password-reset and Google return URLs built from request headers
- **Severity / priority:** Low / Medium · **Type:** Security (host-header injection, CWE-644) · **Found by:** code review
- **Fix:** `appOrigin()` uses `NEXT_PUBLIC_SITE_URL` (headers only in development) (`9529845`, `0e7937f`).
- **Regression check:** code review; covered indirectly by `e2e` auth flows.

### DR-025 — Repeated lookups and a full diary count on every Today load
- **Severity / priority:** Low / Medium · **Type:** Performance · **Found by:** code review
- **Actual:** premium status and beta access were queried 2–3 times per request; Today counted every diary row the user ever logged to decide whether to show the reminder nudge.
- **Fix:** `isPremium` and the beta lookup wrapped in React `cache()`; the nudge reads at most 3 entries (`a9ae9dd`).
- **Regression check:** unit tests unchanged and passing; query count reviewed manually.

### DR-026 — Admin RLS checks run once per row
- **Severity / priority:** Medium / Medium · **Type:** Performance · **Found by:** code review (EXPLAIN)
- **Actual:** policies calling `is_admin()` evaluated it for every row, for every user; the platform spend sum had no index on time.
- **Fix:** migration `20260829000000_rls_perf.sql`: `(select public.is_admin())` (evaluated once per query) and an `ai_usage (created_at)` index (`6cac7e8`).
- **Regression test:** `tests/db/schema.test.ts` (schema parity) and the RLS suites.

### DR-027 — Meal reminders arrive an hour late
- **Severity / priority:** Medium / High · **Type:** Functional · **Found by:** exploratory testing (product owner, Morocco) and code review
- **Actual:** a 13:00 lunch reminder arrived around 14:00, or after the window closed. **Expected:** within the slot's window in the user's time zone.
- **Root cause:** the serverless runtime's `Intl` time-zone data was out of date for `Africa/Casablanca`; the cron also handled users one by one (N+1 queries).
- **Fix:** migration `20260824000000_reminder_local_time.sql` adds `reminder_candidates()`, which resolves local time in Postgres; the cron fetches the batch in 3 queries (`f44888d`).
- **Regression tests:** `src/lib/reminders.test.ts` → "pre-resolved local clock (from Postgres)"; `tests/db/reminders.test.ts` → "reminder_candidates resolves local time in Postgres and is service-only".

### DR-028 — Production can silently fall back to free-tier Gemini
- **Severity / priority:** Medium / Medium · **Type:** Privacy / configuration · **Found by:** code review
- **Actual:** if `LLMGATEWAY_API_KEY` was missing, all AI went to the free Gemini key, whose terms let Google use the data. **Expected:** fail loudly in production.
- **Fix:** `assertFallbackAllowed()` in `src/lib/llm.ts` refuses the fallback in production unless `ALLOW_GEMINI_FALLBACK=1` (`0849339`); `AGENTS.md` updated (`ea9923d`).
- **Regression test:** `src/lib/llm.test.ts`.

### DR-029 — Meal reminders arrive only when the phone wakes or the app opens
- **Severity / priority:** High / High · **Type:** Functional · **Found by:** product owner (Android, installed PWA)
- **Steps:** 1. Enable reminders on Android, breakfast at 10:28. 2. Leave the phone idle (screen off). **Expected:** the notification shows at about 10:30. **Actual:** nothing until the app was opened at 11:36, then the breakfast notification appeared.
- **Evidence:** `reminder_log` shows breakfast sent at 10:30:04 UTC (local 10:30, offset 0); the 10:30 cron run returned `sent: 1` (FCM accepted it). The server was on time; delivery to the phone was held.
- **Root cause:** pushes went out with `Urgency: normal`, which FCM sends at normal priority; Android defers those while the device is idle (Doze) until it wakes or Chrome runs. Secondary: the cron ran every 15 minutes, so a reminder could be up to 14 minutes after the set time.
- **Fix:** `PUSH_OPTIONS` in `src/lib/push-server.ts`: `urgency: "high"` and `TTL` 45 min (a stale breakfast reminder is dropped instead of arriving at lunch); pg_cron job `so3ra-reminders` moved to every 5 minutes.
- **Regression test:** `src/lib/push-server.test.ts` (fails on `urgency: "normal"`, verified before the fix). Device delivery itself: manual check with the phone locked for 15+ minutes.

### DR-030 — Reminder time saved 12 hours off (AM/PM slip)
- **Severity / priority:** Medium / Medium · **Type:** Usability / functional · **Found by:** product owner (Android)
- **Steps:** 1. Lunch is 13:00 (shown as "01:00 PM" on a 12-hour phone). 2. Change only the hour to 11 and the minutes to 47, save. **Expected:** reminder at 11:47. **Actual:** saved `23:47` (`reminder_settings.updated_at` 11:46 UTC); the 11:50–12:05 cron runs correctly found nothing due, so no notification.
- **Root cause:** the phone's time picker keeps the PM half-day when only the hour is edited; the app accepted the value silently and only said "Saved", so the slip wasn't visible. Sending was correct.
- **Fix:** after saving, the Me page echoes the times in 24-hour form ("Saved: Breakfast 10:28 · Lunch 23:47") and warns when a slot is outside its usual window (`implausibleSlots` in `src/lib/reminders.ts`: breakfast 04:00–12:00, lunch 10:30–17:00, dinner 16:00–02:00).
- **Regression test:** `src/lib/reminders.test.ts` → "implausibleSlots (DR-030)".

### DR-031 — Vulnerable framework and library versions (AUD-01)
- **Severity / priority:** Critical (advisory) / High · **Type:** Security (dependencies) · **Found by:** `npm audit` during the end-to-end audit
- **Actual:** Next 16.3.8 (Server Action DoS; image-optimizer SVG and `use cache` RCE advisories), @sentry/nextjs 10.69.0 (tunnel middleware bypass), DOMPurify 3.4.16 via posthog-js (sanitizer bypasses). Reachability was not proven; Server Actions are used throughout, so the DoS advisory applies.
- **Fix:** Next and eslint-config-next 16.4.6, @sentry/nextjs 10.78.0, posthog-js 1.447.15 (DOMPurify 3.4.17), `npm audit fix` for transitive packages. Remaining: 5 moderate advisories in build-time tooling (glob/minimatch under the Sentry bundler plugin); the fix is Sentry 11, a major upgrade, tracked separately.
- **Regression check:** typecheck, lint, 1,276 unit/database tests, production build and public browser tests pass on the new versions.

### DR-032 — OAuth callback redirected to a forwarded host (AUD-02)
- **Severity / priority:** High / High · **Type:** Security (CWE-601) · **Found by:** code review, reproduced against the route handler
- **Steps:** finish Google sign-in with `x-forwarded-host: attacker.example` on the callback request. **Actual:** redirected to `https://attacker.example/dashboard`. **Expected:** stay on So3ra.
- **Root cause:** the callback trusted `x-forwarded-host` for its redirect; `next` was sanitised but the host wasn't.
- **Fix:** redirect relative to the request's own origin, where the session cookie was set.
- **Regression test:** `src/lib/audit-auth.test.ts` (forged host, unsafe `next`, failed exchange).

### DR-033 — Push subscriptions accepted any URL and could be taken over by endpoint (AUD-07, AUD-08)
- **Severity / priority:** High / High · **Type:** Security (CWE-918 SSRF; CWE-639) · **Found by:** code review
- **Actual:** any `https://` URL with non-empty keys was saved, and "Send a test" made the server POST to it. Submitting someone else's endpoint deleted their subscription before anything was validated. Errors saving reminder settings were ignored and reported as success.
- **Fix:** `src/lib/push-endpoint.ts`: only FCM, Apple, Mozilla and Windows push hosts on port 443 without credentials; keys must be a 65-byte P-256 point and a 16-byte secret. Stored rows that fail the check are never requested and are removed. An existing endpoint moves to another account only with the same keys (same browser), as an update, never delete-first. Settings errors now fail the action.
- **Regression test:** `src/lib/push-endpoint.test.ts` (allowed services, metadata IP, localhost, http, port, credentials, look-alike hosts, key sizes).

### DR-034 — Offline meals replayed into whichever account signed in next (AUD-03)
- **Severity / priority:** High / High · **Type:** Privacy / data integrity · **Found by:** code review, reproduced in a unit test
- **Steps:** 1. Account A logs a meal while offline. 2. A signs out, B signs in on the same phone. 3. Back online. **Actual:** A's meal is saved in B's diary. **Expected:** it stays A's.
- **Root cause:** one device-wide queue (`fittrack-offline-queue`) with no owner; sign-out didn't touch it.
- **Fix:** one queue per account (`so3ra-offline-queue:<user>`), owner set by the app shell and cleared on sign-out; each entry carries its owner and the server refuses a replay into another account (`wrongAccount`). Entries from the old shared queue are never replayed automatically: Today asks "Add to my diary" or "Discard".
- **Regression tests:** `src/lib/offline-queue.test.ts` → "offline queue is per account (AUD-03)".

### DR-035 — Offline meals could be lost or doubled without notice (AUD-04)
- **Severity / priority:** High / High · **Type:** Data integrity · **Found by:** code review, reproduced in unit tests
- **Actual:** (a) when storage was full or blocked the app still said "saved on this device"; (b) the 101st entry silently evicted the 1st; (c) an entry the server rejected (e.g. a deleted recipe) was dropped; (d) a replay whose response was lost was logged again on the next attempt.
- **Fix:** `enqueue` reports whether the entry was stored (with a read-back); a full queue refuses new entries and the UI says the meal was NOT saved; rejected entries stay listed with the reason (Retry / Discard); each entry has a `client_id` and `diary_entries (user_id, client_id)` is unique (migration `20260901000000_diary_client_id.sql`), so a repeat replay counts as already logged.
- **Regression tests:** `src/lib/offline-queue.test.ts` → "never loses entries silently (AUD-04)"; `tests/db/offline-replay.test.ts`.

### DR-036 — Food review could be skipped or faked with direct writes (AUD-05)
- **Severity / priority:** Medium / Medium · **Type:** Security (integrity) · **Found by:** code review, reproduced in the test database
- **Actual:** inserting a food without `review_status` kept it out of the queue; users could set `reviewed_by`/`reviewed_at` to anyone. (The food stayed private; this was not a publishing bypass.)
- **Fix:** trigger `foods_enforce_review` (migration `20260902000000_food_review_enforced.sql`): a non-admin's food is always `pending` on create and after any change to its facts; reviewer fields are kept from the previous row. Admin and service-role writes are untouched; a rejected food stays editable and an edit resubmits it.
- **Regression tests:** `tests/db/food-review.test.ts` → "review is enforced by the database (AUD-05)".

### DR-037 — Exports cut off at 1,000 rows, or empty on a database error (AUD-14)
- **Severity / priority:** Medium / Medium · **Type:** Functional · **Found by:** code review
- **Actual:** `/api/export` read the diary in one request; PostgREST returns at most 1,000 rows, so long-time users got a truncated file that looked complete; a failed read produced an empty file.
- **Fix:** `fetchAll` (`src/lib/fetch-all.ts`) pages through with a stable order (date, time, id) and fails the request (503, nothing downloaded) on any page error.
- **Regression test:** `src/lib/fetch-all.test.ts` (0, 999, 1,000, 1,001, 2,500 rows; error on page 2).

### DR-038 — AI caps could be exceeded with parallel requests; checks failed open (AUD-09)
- **Severity / priority:** High / High · **Type:** Cost control (race condition, CWE-362) · **Found by:** code review
- **Actual:** each AI entry point counted today's usage, then called the model, then recorded usage. N requests sent at once all saw the same count and all ran (e.g. 10 coach messages on a 5/day cap). A metering read error, or a missing service key, allowed the call; a failed spend read disabled the platform cap.
- **Fix:** migration `20260903000000_ai_reservations.sql`: `reserve_ai_call` locks per user and feature, counts finished calls plus reservations still in flight (< 10 min), and refuses or inserts a reservation in one step; `record_ai_usage` fills that reservation with the real usage. A reservation whose call failed stops counting after 10 minutes. Reservation errors, a missing service key and failed spend reads now pause AI ("temporarily unavailable") instead of allowing it.
- **Regression tests:** `tests/db/ai-reservations.test.ts` (cap boundaries with in-flight reservations, monthly cap, expiry, per user/feature, service-only); `src/lib/ai-usage.test.ts` (caps passed, mapping, fail-closed).
- **Still external:** set a hard spend limit on the LLM Gateway key as the last line of defence.

### DR-039 — A reminder that failed to send was never retried (AUD-06)
- **Severity / priority:** High / Medium · **Type:** Functional (reliability) · **Found by:** code review, reproduced in the test database
- **Actual:** the sender wrote the "sent today" row before sending and kept it whatever happened, so a transient push error (FCM 5xx, timeout) lost that meal's reminder for the day. Failed reads of subscriptions, diary or log were treated as empty.
- **Fix:** migration `20260904000000_reminder_delivery_state.sql`: `reminder_log` rows are `claimed → sent | failed` with an attempt count; `claim_reminder` atomically retries a failed slot after 4 minutes (or a claim left by a crashed run after 5), at most 3 attempts, within the send window. A slot is `sent` once any device's push service accepted it. Read errors stop the run (500) instead of sending blind. "Sent" means accepted by the push service, not displayed by the phone.
- **Regression tests:** `tests/db/reminders.test.ts` → "claim_reminder…"; `src/lib/reminders.test.ts` → "retry after a failed send (AUD-06)".

### DR-040 — Reminder clock not updated for a second account or after resuming (AUD-12)
- **Severity / priority:** Medium / Medium · **Type:** Functional · **Found by:** code review
- **Actual:** the "offset already synced" cache was one value per device, so a second account at the same offset never synced its clock; sync ran only on a full page load, not when the app came back from the background (e.g. after a daylight-saving change or a flight); a failed save was cached as done. The user couldn't see which clock reminders followed.
- **Fix:** cache per account, re-check on `visibilitychange`, cache only after the server confirms; Me shows "Reminders follow your phone's clock: Africa/Casablanca UTC+0".
- **Regression check:** typecheck and unit tests; device behaviour (resume after a time-zone change) is on the staging checklist.

### Accepted risks (not fixed)
- **Open Food Facts names in AI prompts:** third-party text reaches the model (prompt injection, CWE-1427). Low impact: output is structured and confirmed by the user. Revisit before bulk imports.
- **Coach loads up to 400 library foods per message:** token cost, not correctness. Revisit when the library grows.
