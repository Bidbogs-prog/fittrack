# Test strategy

## 1. Context and quality goals

So3ra gives people calorie targets and AI nutrition advice. Wrong numbers or unsafe advice harm users, so the quality characteristics (ISO 25010) are ranked:

1. **Safety and correctness of advice** — nutrition maths, safety gates (age, low BMI, calorie floor), coach refusals.
2. **Security and privacy** — health-adjacent data (CNDP law 09-08 in Morocco, GDPR for France), row-level security, no open redirects.
3. **Functional suitability** — logging, AI parsing, edits, premium limits.
4. **Usability and accessibility** — three languages incl. right-to-left Arabic, mobile-first PWA, keyboard and screen-reader use.
5. **Performance efficiency and cost** — page speed, AI cost per user (it is a running cost, so it is tested like a non-functional requirement).

## 2. Test levels

| Level | Scope | How | Status |
|---|---|---|---|
| Component (unit) | Pure logic: nutrition maths, adaptive TDEE, safety thresholds, quotas, entitlements, redirects, intent routing, diary helpers | Vitest, test doubles for Supabase | Automated, in CI |
| Component integration | Contracts between modules: i18n keys exist in all locales, client components receive their message namespaces, server code never calls client-only helpers | Vitest static/contract tests | Automated, in CI |
| System | Full flows in a browser against a test backend | Playwright, AI responses mocked | Planned (next iteration) |
| System — AI behaviour | Coach replies against a fixed user fixture | Live-model eval, deterministic checks + LLM judge | Automated, on demand |
| Acceptance | Real users in the closed beta | Beta test plan, analytics, interviews | In progress |

## 3. Test types

- **Functional** — every test level above.
- **Non-functional**
  - Security: open-redirect regression suite, security headers, RLS policies (planned: database-level tests), consent before analytics.
  - Usability/accessibility: manual exploratory sessions on iPhone/Android; planned axe-core scan and keyboard pass.
  - Performance: manual Lighthouse runs; database round trips reduced and measured per page.
  - Cost: per-call `ai_usage` metering; daily spend kill switch; caps tested with BVA.
- **Confirmation and regression** — every fixed defect gets an automated check where possible ([defects.md](defects.md)).
- **Static testing** — ESLint, TypeScript strict mode, code review of every change, review of AI prompts against the safety requirements.

## 4. Approach

- **Risk-based**: test effort follows [risk-register.md](risk-register.md); high risks get automated tests at more than one level.
- **Shift left**: thresholds and limits are pure functions so they can be tested with boundary values without a database.
- **Exploratory testing** on real devices for each release; findings become defect reports and regression tests (most production defects so far were found this way).
- **AI is tested as a component with a contract**: fixed fixture, fixed judge model, repeated runs to separate model noise from real failures ([ai-testing.md](ai-testing.md)).

## 5. Test environment and data

- Unit/contract tests: no network, Supabase replaced by stubs.
- AI eval: live gateway, fixed fixture user (`src/lib/coach/eval-fixture.ts`), judge model pinned.
- Manual testing: production deployment with an invite-gated test account; premium granted via the `entitlements` table.
- No real user data is ever used as test data.

## 6. Entry and exit criteria (quality gate)

**Entry (to merge/deploy):** change builds locally, scope described in the commit.

**Exit (to deploy):**
- CI green: lint, type check, all automated tests, production build.
- Any change to the coach prompt, evidence briefs or coach context: coach eval 28/28 on two consecutive runs.
- Database migrations reviewed for RLS on every new table.
- No open defect of severity Critical or High.

## 7. Defect management

Defects are recorded in [defects.md](defects.md) with: summary, environment, steps to reproduce, expected vs actual, severity (impact) and priority (urgency), root cause, fix, and regression test. Severity scale: Critical (harm/security/data loss), High (core flow broken), Medium (feature degraded, workaround exists), Low (cosmetic).

## 8. Tools

Vitest · ESLint · TypeScript · GitHub Actions · LLM Gateway (eval) · PostHog (beta metrics) · Sentry (production errors) · Chrome DevTools / Lighthouse · planned: Playwright, axe-core.
