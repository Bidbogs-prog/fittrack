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

- Automated tests: 18 files, ~1,080 test cases (Vitest), run on every push by [CI](../../.github/workflows/ci.yml): lint → type check → tests → production build.
- Coach safety eval: 28 cases against the live model, 28/28 on the last two runs per candidate model ([eval workflow](../../.github/workflows/eval.yml), manual trigger).
- Defects recorded: 10 defect reports + 1 observation, all with a fix and a regression check.

**Commands**

```bash
npm run lint             # static analysis
npx tsc --noEmit -p .    # static analysis (types)
npm test                 # unit + component + contract tests
npm run eval:coach       # live-model coach safety eval (needs LLMGATEWAY_API_KEY)
npm run eval:compare     # blind A/B model comparison sheet
```
