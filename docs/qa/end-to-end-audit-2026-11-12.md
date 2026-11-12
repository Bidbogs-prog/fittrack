# So3ra end-to-end audit — 12 November 2026

Baseline: `96f6a98`. Review only: no application fixes, production mutations, commits or pushes made in this audit. Added six isolated characterization tests. They PASS when reproducing current defects; they are not acceptance tests asserting safe behavior. Invert the assertions when fixing their corresponding findings.

## Executive assessment

Not ready for an unrestricted launch without security/dependency remediation and authenticated device testing. Existing automated checks are green, but they miss important state transitions: account switching, delivery failure, permission-dialog cancellation, concurrent requests and direct database writes.

## Methods and evidence

- White-box: inspected authentication, account/admin actions, diary/recipes/foods/plans, AI routes and quotas, voice capture, reminders, offline storage, service worker, exports, translations, database policies and test configuration. Automated-assisted review was followed by direct inspection of cited findings. This is a risk-based review, not a proof that every line is correct.
- Black-box: ran the existing production-build Playwright suite (desktop and mobile Chromium) including public journeys, RTL desktop, headers, consent, legal pages, invalid email and axe accessibility checks. Command passed. There are 40 configured cases; four authenticated scenarios per browser are skipped without E2E credentials, and mobile language-switch coverage is explicitly skipped. No signed-in browser coverage was established by this run.
- Live, read-only HTTP checks: homepage 200; unauthenticated diary export, barcode lookup and reminder cron 401; dashboard and admin review redirect to login with return paths. No production exploit traffic or test account mutations.
- Baseline `project check`: typecheck, lint and unit/database tests passed. Browser suite builds the production app.
- Dependency inventory: `npm audit --omit=dev` reported 10 affected packages: 3 critical, 1 high, 6 moderate. These are package/advisory ratings, NOT ten confirmed exploitable app vulnerabilities.
- Six new reproductions pass: `src/lib/audit-review.test.ts` (3), `tests/db/audit-review.test.ts` (2), `src/lib/audit-auth.test.ts` (1). Database cases use disposable PGlite with actual migrations; OAuth exchange is mocked, not performed against production.

## Findings, prioritized

### AUD-01 — P0: dependency security advisories require immediate triage
**Evidence:** installed Next 16.3.8, @sentry/nextjs 10.69.0 and DOMPurify 3.4.16 (via posthog-js). Registry audit flags Next image SVG RCE, typed-array `use cache` RCE and Server Action DoS; Sentry tunnel middleware bypass; DOMPurify sanitizer bypasses. Other packages include source-map-js, fast-uri, glob and minimatch.
**Qualification:** `next.config.ts` has no explicit dangerouslyAllowSVG or Sentry tunnel; the Sentry package is not configured through withSentryConfig here. Do not equate installation with reachable RCE. Server Actions are heavily used, making that advisory particularly relevant. No exploit was attempted.
**Action:** upgrade to patched supported versions (audit suggests Next 16.4.6), refresh transitive dependencies, review upstream prerequisites, then rebuild and rerun browser/auth tests. Do not run a blind force-upgrade.
**References:** GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, GHSA-673q-mjm6-r5xr, GHSA-mchm-gjx6-7h55, GHSA-cg2g-xh64-v4q7.

### AUD-02 — High, reproduced in handler: forwarded-host OAuth redirect
**Where:** `src/app/auth/callback/route.ts:15–19`.
**Steps:** successful code exchange in production mode with `x-forwarded-host: attacker.invalid` redirects to that host even though `next` is sanitized.
**Evidence:** `src/lib/audit-auth.test.ts` exercises the actual GET handler with a mocked successful exchange.
**Impact:** external redirect after login; deployment exploitability depends on whether the hosting proxy overwrites this header. This test does not demonstrate session-cookie theft or a live Vercel bypass.
**Fix:** use the configured canonical app origin, not client/proxy headers; test both callback success and failure destinations.

### AUD-03 — High, reproduced storage behavior: offline queue crosses accounts
**Where:** `src/lib/offline-queue.ts:11–20`, `src/app/(app)/dashboard/offline-sync.tsx:31–46`, `src/components/sign-out-form.tsx:13–32`.
**Steps:** A queues a quick meal offline; A signs out; B signs in on the same browser; the shared queue is replayed using B's session.
**Evidence:** characterization test proves queue items contain no account key; sign-out clears page caches and push, not this queue. End-to-end account switching remains to be exercised in a test Supabase project.
**Impact:** nutrition data is attributed to the wrong user, with possible privacy exposure on shared devices.
**Fix:** owner-keyed queues, explicit ownership checks on replay and an account-switch policy for unsynced work; never silently discard it.

### AUD-04 — High, reproduced storage behavior / inspected replay: offline success can mean lost data
**Where:** `src/lib/offline-queue.ts:33–38`, `src/app/(app)/dashboard/offline-sync.tsx:42–46`.
**Cases:** storage write errors are swallowed; entry 101 silently evicts entry 1; replay removes entries even when the action returns an error.
**Evidence:** tests confirm silent storage failure and eviction. Replay deletion is explicit in source.
**Fix:** make enqueue return a persisted/not-persisted result, keep a failed-items inbox with retry/correct/discard, and use idempotency keys on server writes. Lost-response retries and multiple tabs also need duplicate-prevention tests.

### AUD-05 — Medium, database-confirmed: food review is not mandatory at the database boundary
**Where:** `supabase/migrations/20260831000000_food_review.sql:19–27`.
**Steps:** insert own food without review_status; it succeeds with NULL and is absent from the pending queue. Update reviewed_by to another user's ID; this succeeds too.
**Impact:** app UI submits correctly, but direct authenticated writes can evade the promised review queue or falsify provenance. Crucially, the food remains private: the test also verifies another normal user cannot read it. This is NOT an approval/publication bypass.
**Fix:** database default/trigger enforces pending on user creation and substantive edits; only admins may set reviewer metadata. Add negative tests for direct writes, not just form actions.

### AUD-06 — High, reproduced claim semantics: failed push permanently consumes today's slot
**Where:** `src/app/api/cron/reminders/route.ts:85–92`.
**Steps:** cron inserts reminder_log, then every push attempt fails transiently. The claim is never released or marked failed. All subsequent runs suppress that slot.
**Evidence:** isolated DB + dueSlots test confirms a claim alone blocks subsequent sends, independent of success. Source leaves the claim on failure.
**Fix:** separate claimed/succeeded/failed states, a lease and retry backoff; track per-device delivery attempts. Handle query errors at lines 55–59 rather than treating missing results as empty successful reads.
**Important correction:** existing `sent` means push provider accepted a request, NOT that Android displayed it. High urgency improves delivery likelihood but does not guarantee delivery during offline periods, force-stop or battery restrictions. Earlier certainty that Doze was the proven cause, and that high urgency guarantees display, exceeded available evidence.

### AUD-07 — High, source-confirmed unsafe destination: push subscription SSRF surface
**Where:** `src/app/(app)/account/reminder-actions.ts:36–40`, `src/lib/push-server.ts:48–54`.
**Steps:** authenticated user registers an arbitrary HTTPS URL and syntactically valid encryption keys, then triggers a test reminder. The server passes that URL into web-push's HTTP client.
**Impact:** attacker-controlled outbound request destination; internal network reach and response visibility depend on deployment and library behavior. No internal destination was contacted in this audit.
**Fix:** explicitly allow supported push-service hosts, validate URL/port/credentials and subscription key formats, prevent private-address/DNS redirect bypasses, and rate-limit registration/test sends. Retain support for FCM, Apple and Mozilla as appropriate.

### AUD-08 — Medium, source-confirmed: subscription takeover deletes before validating replacement
**Where:** `src/app/(app)/account/reminder-actions.ts:47–56`.
**Steps:** a user who obtains another subscription endpoint submits it with invalid keys. Admin-client deletion removes its previous owner before insert/delivery validation.
**Impact:** notification denial of service for a known endpoint; endpoint knowledge is a prerequisite, not generally public information.
**Fix:** verify ownership/key continuity and use an atomic transfer; never destroy the existing row before the replacement is validated. Registration also ignores reminder_settings write errors yet reports success.

### AUD-09 — High cost risk, source-confirmed: AI limits are check-then-write, not reservations
**Where:** `src/lib/ai-usage.ts:148–193`, AI call sites recording usage after generation.
**Steps:** concurrent requests all read the same below-limit usage and proceed. A metering outage returns permission to continue; missing admin key also disables spend enforcement.
**Impact:** configured daily limits are advisory under concurrency/outages; spend can exceed the expected cap. No paid load test performed.
**Fix:** atomic per-user reservations and bounded concurrency, explicit degraded-mode policy, gateway hard budget. Keep a user-friendly outage message rather than silently dropping metering.

### AUD-10 — Medium, source-confirmed: long coach conversations lose early context before first summary
**Where:** `src/app/api/coach/route.ts:29–31,119,247–258`.
**Explanation:** only 12 previous messages are fetched; first summary occurs when total reaches 24 (greater than 20 and divisible by 6). Its input contains those 12 plus the newest two, not the earliest 10. Earlier conversation content never enters the first summary.
**Impact:** early commitments/preferences/questions disappear from context despite the rolling-memory promise. Premium fact memory is separate and does not make this summary correct.
**Fix:** summarize the messages being evicted using a persisted watermark; test a conversation with uniquely numbered facts over 30+ turns.

### AUD-11 — Medium, source-confirmed: voice permission race and lifecycle cleanup gaps
**Where:** `src/components/orbit/log-provider.tsx:367–428`.
**Steps:** start recording while permission is pending, then navigate away or start again. mediaRef is assigned only after awaiting getUserMedia. Cleanup cannot see the not-yet-created stream; multiple pending starts can both proceed.
**Impact:** unexpected microphone activation after navigation, duplicate capture and processing. Timers are not cleared in all error/unmount paths; no MediaRecorder error handler is installed.
**Fix:** pending/start/recording/transcribing state machine, cancellation token checked after permission resolves, one owner for stream/timer cleanup. Test delayed permission, denied permission, navigation, double tap and recorder errors.

### AUD-12 — Medium, source-confirmed: reminder clock sync can go stale or cross accounts
**Where:** `src/components/reminder-settings.tsx:229–242`.
**Explanation:** a single device-wide offset cache suppresses writes for a second account at the same offset; sync runs only at mount, not on visibility changes. The fixed numeric offset overrides the timezone until another successful sync.
**Impact:** DST/travel or account switching can leave a reminder clock wrong; different devices can overwrite the same account clock.
**Fix:** define an explicit account reminder timezone and display it, or track per-device scheduling state; account-key the cache, check server result, resync on resume. Do not treat the previous phone offset as a permanent timezone rule.

### AUD-13 — Medium, source-confirmed: barcode network errors look like missing products
**Where:** `src/components/orbit/composer.tsx:113–127`, `src/app/(app)/foods/scan-button.tsx:18–30`.
**Steps:** offline fetch or HTTP error takes the same path as a successful lookup with no product. The UI offers creation.
**Impact:** duplicate submissions and user confusion during outages/auth expiry.
**Fix:** distinguish found / not-found / retryable error / signed-out, check res.ok, retain the barcode through retries and form-validation errors.

### AUD-14 — Medium, source-confirmed: data export can be incomplete without warning
**Where:** `src/app/api/export/route.ts:31–37,58–65`.
**Explanation:** unpaginated Supabase reads are subject to the configured row cap; errors are ignored and converted to empty arrays. Typical 1,000-row limits can truncate a frequent user's diary.
**Impact:** an apparently successful backup can omit history or be empty after a database failure.
**Fix:** keyset/range pagination with stable ordering and explicit error responses; confirmation tests at row-limit minus one, exactly the limit, and above it. Actual production row cap not queried in this audit.

### AUD-15 — Medium, source-confirmed: food moderation UI can strand items and mislabel ownership
**Where:** `src/app/(app)/admin/foods/review/page.tsx` (limit 100, no pagination); `src/lib/foods.ts:29–40`; `src/app/api/foods/barcode/route.ts:20–27`.
**Explanation:** admin review sees only the oldest 100; an admin's "mine" filter is any non-null owner under broadened admin RLS, not the admin's ID. Barcode lookup similarly chooses any private row and limits to two, so admins can receive another submitter's private food instead of their own/global product.
**Fix:** explicit owner filters rather than relying on RLS as a UI filter; queue counts/pagination, edit-before-approve and rejection reasons. Test admin and user views separately.

### AUD-16 — Medium, source-confirmed: new voice processing is missing from privacy disclosure
**Where:** `src/app/privacy/page.tsx:20`; `src/app/(app)/dashboard/voice-actions.ts`.
**Explanation:** policy lists voice transcripts, while the new feature sends raw audio to the AI provider. Local deletion is not proof of provider non-retention.
**Fix:** disclose recording upload, processor and verified retention terms; make the microphone interaction explain transcription. Do not invent retention guarantees.

### AUD-17 — Usability and assurance gaps
- User food creation/form and several account validation errors remain English-only despite French/Darija support (`src/app/(app)/foods/new/page.tsx`, `user-food-form.tsx`, `account/actions.ts`). Translate the complete journey, not just navigation.
- Mobile language-switch test is explicitly skipped because the switcher is hidden. This under-tests the mobile Moroccan acquisition journey.
- Browser tests cover four authenticated flows only when credentials exist; no automated real-device push, recording, admin review or offline account-switch acceptance suite ran here.
- Previous DR-022 claims CSP includes form-action, but `next.config.ts:32` does not. Basic CSP is not script-injection protection; tighten it in report-only mode before enforcement.
- Rounding after validating positive serving amounts can turn 0.01 into 0 in food/recipe forms; DB constraints may reject it, but UX shows a persistence error rather than field validation. Validate the rounded representation.

## Requirement/output review

| Area | Result | Missing assurance or mismatch |
|---|---|---|
| Public landing/auth boundaries | Public browser suite and live HTTP checks pass | Signed-in callback host trust remains |
| Private user data | Existing DB suite passes | Offline queue bypasses account isolation locally |
| Food approval | App creates pending; public sharing remains admin-only | Direct DB inserts evade queue; reviewer metadata writable |
| Meal/recipe logging | Existing calculation/unit tests pass | Offline loss, retry duplication risk, tiny-portion validation |
| Coach | Mocked public test setup works; unit/eval helpers pass | Early summary omission; no live safety evaluation run this audit |
| Voice, Arabic/Darija | Implementation reviewed; unit tests pass | Permission race; real multilingual/device acceptance not run |
| Reminders | Scheduler logic unit tests pass | Claimed != sent != displayed; retry and clock lifecycle gaps |
| Export | Auth boundary rejects signed-out reads | Pagination/error handling needs correction |
| Localization/accessibility | Public axe and desktop RTL checks pass | Signed-in forms/mobile language selection coverage incomplete |

## Value opportunities (not defects)

1. **Trust/status panel:** show last saved meal, unsynced items and failed-item recovery; avoid "saved" without persistence.
2. **Reminder diagnostics:** display account timezone, next due time, provider acceptance and device acknowledgement separately; self-service test with useful failure reasons. Do not promise exact-minute push delivery.
3. **Better Moroccan food capture:** label photo/OCR prefill with mandatory nutrition confirmation; duplicate barcode detection; correction requests and provenance badges.
4. **Moderation feedback:** rejection reason, edit/resubmit workflow, queue count/age and pagination. Explain that pending food is already usable privately.
5. **Voice confirmation:** editable transcript before expensive meal parsing or sending to Coach; visible recording duration and explicit cancel.
6. **Retention through reduced effort:** repeat yesterday's meal, favorite portions and recent Moroccan staples before competitive mechanics; measure time-to-first-successful-log and D7 retention.
7. **Release gates:** disposable authenticated Supabase tests; Android/iOS recording and idle-push checklist; dependency audit triage; non-English forms and offline error journeys.

## Recommended order

1. Dependency patch triage, push URL restrictions and canonical OAuth origin.
2. Account-scoped offline storage, retry/error recovery and atomic AI reservations.
3. Reminder delivery state machine/observability and voice lifecycle cancellation.
4. Enforce food review at DB boundary, repair long-chat summaries and complete exports.
5. Localization, mobile usability, moderation workflow and product-value experiments.

## Remediation roadmap

End-to-end testing on a staging Supabase project is postponed (MCP connection blocked by certificate trust on this machine). Fixes below are verified with unit/database tests and public browser tests; signed-in and device acceptance stays open until staging exists.

| Phase | Items | Goal | Status |
|---|---|---|---|
| 1. Security now | AUD-01 dependencies, AUD-02 OAuth host, AUD-07 push SSRF, AUD-08 push takeover | No known reachable security issue | **Done** (DR-031–DR-033) |
| 2. Data integrity | AUD-03 offline queue per account, AUD-04 offline loss/eviction/error handling, AUD-05 food review enforced in the DB, AUD-14 complete exports | No silent data loss or misattribution | **Done** (DR-034–DR-037) |
| 3. Cost and reliability | AUD-09 atomic AI reservations, AUD-06 reminder claim/retry states, AUD-12 clock sync per account and on resume | Limits hold under concurrency; reminders retry | **Done** (DR-038–DR-040) |
| 4. Correctness and UX | AUD-10 coach summary of evicted turns, AUD-11 voice state machine, AUD-13 barcode errors vs not found, AUD-15 review queue pagination and owner filters | Features do what they promise | **Done** (DR-041–DR-044) |
| 5. Trust and polish | AUD-16 privacy text for voice audio, AUD-17 translations of food/account forms, CSP form-action, rounding validation | Copy and policy match behaviour | **Done** (DR-045–DR-048) |
| 6. Acceptance | Staging Supabase + Vercel, signed-in Playwright suite, Android/iPhone push and voice checklist | Close the "unverified" list | Postponed |

Each fix: regression test first (characterization tests in `src/lib/audit-review.test.ts` and `tests/db/audit-review.test.ts` are inverted when their item is fixed), then a DR entry in `defects.md`.

## Limits / follow-up acceptance

This audit did not authenticate into a production user account, trigger real push notifications, probe internal networks, load-test paid AI, run live coach red-team evaluations, or verify Android/iOS behavior with a locked physical phone. Those are explicit unverified areas, not passes. Provide a non-production Supabase environment with E2E credentials and physical-device checks before calling the app fully end-to-end validated.
