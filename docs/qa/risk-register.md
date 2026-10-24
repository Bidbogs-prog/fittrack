# Product risk register

Likelihood (L) and impact (I) on a 1–3 scale; risk level = L × I. High = 6–9, Medium = 3–4, Low = 1–2.

| ID | Risk | L | I | Level | Mitigation | Tested by |
|---|---|---|---|---|---|---|
| R1 | Coach gives unsafe advice (extreme restriction, purging, medical dosing) or misses a risk pattern | 2 | 3 | **High** | Deterministic safety gates before any model call; restricted mode; refusal rules in the prompt; named help resources | `safety.test.ts`, `safety.boundaries.test.ts` (BVA), coach eval (28 cases), TC-SAF-* |
| R2 | Minors reach the coach | 2 | 3 | **High** | Server-side age gate in the coach route and the day read | `safety.boundaries.test.ts` (17/18), eval fixture, TC-SAF-01 |
| R3 | Wrong calorie/macro targets (formula, adaptive, exercise handling) | 2 | 3 | **High** | All maths in `src/lib/nutrition.ts` / `adaptive.ts`; exercise never added to the target (DR-006) | `nutrition.test.ts`, `adaptive.test.ts`, TC-NUT-* |
| R4 | Security: open redirect, cross-user data access, secrets leaked | 2 | 3 | **High** | `safeRedirectPath`; RLS on every table; server-only AI keys; security headers | `redirect.test.ts`, migration review checklist; planned RLS tests |
| R5 | AI cost runs away (abuse, bug loop, generous free tier) | 2 | 2 | Medium | Per-user daily/monthly caps; daily spend kill switch; gateway key spend limit | `ai-usage.test.ts` (BVA), `ai_usage` dashboard |
| R6 | Premium access wrong (paying user blocked, or free user gets premium) | 2 | 2 | Medium | Single `isPremium` check, fail-closed | `entitlements.test.ts` (decision table) |
| R7 | AI meal parsing logs wrong foods/amounts silently | 2 | 2 | Medium | Every parse goes through a confirmation sheet; edits need explicit Apply | Live parser smoke runs; planned Playwright flows |
| R8 | Broken UI text or layout in French / Arabic (RTL) | 3 | 1 | Medium | Messages in three locales; contract tests | `messages.test.ts`, `message-usage.test.ts`, `client-namespaces.test.ts` |
| R9 | Privacy/consent: analytics before consent, data kept after deletion | 1 | 3 | Medium | Consent banner gates PostHog and client Sentry; cascade deletes | Manual check per release; planned E2E |
| R10 | Third-party outage (AI provider, Google sign-in) blocks core flows | 2 | 2 | Medium | Fallbacks (Gemini direct, Supabase OAuth redirect); logging never depends on AI | Manual failure-injection (no gateway key, blocked script) |
| R11 | Performance: slow page loads on mobile networks in Morocco | 2 | 1 | Low | Loading skeletons, parallel data fetches, client page cache | Manual Lighthouse; planned CI budget |
