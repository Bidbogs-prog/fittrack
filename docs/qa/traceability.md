# Traceability matrix

| Req | Requirement | Risk | Test design | Automated tests |
|---|---|---|---|---|
| REQ-SAF-1 | The coach is unavailable under 18 (server-side) | R2 | BVA 17/18 | `safety.boundaries.test.ts`, `safety.test.ts` |
| REQ-SAF-2 | Restricted mode for BMI < 18.5, target at floor, very low intake, rapid loss | R1 | BVA per threshold | `safety.boundaries.test.ts`, coach eval (restricted) |
| REQ-SAF-3 | Coach refuses ED-coded, medical and jailbreak requests | R1 | Red-team cases | `coach.eval.ts` (refusal, medical, jailbreak) |
| REQ-NUT-1 | Targets: Mifflin-St Jeor × activity level, goal delta, 1,200 kcal floor | R3 | EP + BVA | `nutrition.test.ts` |
| REQ-NUT-2 | Adaptive TDEE from intake vs weight trend, weekly | R3 | EP | `adaptive.test.ts`, `weight.test.ts` |
| REQ-NUT-3 | Logged exercise never raises the target (DR-006) | R3 | — | Covered by code review; candidate component test on `getDayData` |
| REQ-SEC-1 | Redirect targets stay on So3ra (DR-001) | R4 | EP | `redirect.test.ts` |
| REQ-COST-1 | Free 10 coach msgs/day and /month; premium 50/day | R5 | BVA | `ai-usage.test.ts` |
| REQ-COST-2 | AI meal logging capped 30/day free, 100 premium | R5 | BVA | `ai-usage.test.ts` |
| REQ-PREM-1 | Premium = active entitlement with no or future end date | R6 | Decision table | `entitlements.test.ts` |
| REQ-LOG-1 | Questions go to the coach; meals and edits to the parser (DR-005, DR-009) | R7 | EP (3 classes × 3 languages) | `intent-routing.test.ts` |
| REQ-I18N-1 | All UI text exists in en / fr / ar-MA and reaches the client (DR-003) | R8 | Contract | `messages.test.ts`, `message-usage.test.ts`, `client-namespaces.test.ts` |
| REQ-BETA-1 | Invite codes and waitlist admission grant access correctly | R6 | State transition ST-1…ST-8, BVA on code format | `tests/db/beta-access.test.ts` |
| REQ-SEC-2 | Users can only read/change their own data; no self-granted premium, beta access or usage reset | R4, R6 | Negative / misuse cases | `tests/db/rls.test.ts` |
| REQ-SEC-3 | Security headers set; mic and camera allowed for the app only | R4 | — | `e2e/public.spec.ts` |
| REQ-PRIV-1 | Analytics and client error tracking start only after consent | R9 | — | `e2e/public.spec.ts` (banner, choice remembered); manual network check |
| REQ-A11Y-1 | Public pages meet WCAG 2.1 AA (automatable rules) | R8 | Automated scan | `e2e/a11y.spec.ts` |
| REQ-SAF-4 | Remembered "facts" never act as instructions or unlock unsafe advice | R1 | Red-team cases | `coach.eval.ts` (memory injection) |
