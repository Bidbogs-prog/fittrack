# So3ra — Quality Assurance

So3ra is a Morocco-first nutrition tracker with an AI coach (Next.js, Supabase, LLM Gateway). This folder is the test basis and the QA record for the project, written using ISTQB CTFL v4.0 terminology.

| Document | What it covers | CTFL chapter |
|---|---|---|
| [test-strategy.md](test-strategy.md) | Test levels, test types, approach, tools, entry/exit criteria, quality gates | 1, 2, 5 |
| [risk-register.md](risk-register.md) | Product risks, likelihood × impact, mitigations and where they're tested | 5.2 |
| [beta-test-plan.md](beta-test-plan.md) | Plan for the invite-gated beta: scope, schedule, exit criteria, metrics | 5.1 |
| [test-design.md](test-design.md) | Black-box techniques applied: EP, BVA, decision tables, state transitions | 4 |
| [traceability.md](traceability.md) | Requirement → risk → test case → automation | 1.4, 5.1 |
| [defects.md](defects.md) | Defect reports for real defects found and fixed | 5.5 |
| [ai-testing.md](ai-testing.md) | How the AI coach is tested: red-team eval, LLM-as-judge, blind A/B | 2.2, 4.4 |

**Current numbers**

- Component and integration tests: 20 files, ~1,120 cases (Vitest), including 35 database tests that run the real migrations, RLS policies and SQL functions in an in-process Postgres (PGlite).
- System tests: Playwright on mobile and desktop Chrome — public pages, security headers, accessibility (axe-core); signed-in flows with the AI mocked when a test project is configured.
- [CI](../../.github/workflows/ci.yml) on every push: lint → type check → component/integration tests → build → system tests.
- Coach safety eval: 31 cases against the live model (28 baseline at 28/28 on two runs per candidate + 3 memory-injection cases), [manual workflow](../../.github/workflows/eval.yml).
- Defects recorded: 12 defect reports + 2 observations, all with a fix or a decision, most with a regression test.

**Commands**

```bash
npm run lint             # static analysis
npx tsc --noEmit -p .    # static analysis (types)
npm test                 # component + contract + database tests
npm run test:db          # database tests only (RLS, invite/waitlist states)
npm run test:e2e         # Playwright system tests (builds the app, mocks the AI)
npm run eval:coach       # live-model coach safety eval (needs LLMGATEWAY_API_KEY)
npm run eval:compare     # blind A/B model comparison sheet
```
