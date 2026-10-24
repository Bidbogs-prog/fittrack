# Test design — techniques applied

Examples of CTFL chapter 4 black-box techniques, each backed by automated tests.

## 1. Equivalence partitioning — redirect targets (`src/lib/redirect.test.ts`)

| Partition | Representative values | Expected |
|---|---|---|
| Valid: same-origin path | `/dashboard`, `/coach?c=new&q=hi`, `/history#week`, `/foods/../account` | Kept (normalised) |
| Invalid: protocol-relative / backslash | `//evil.com`, `/\evil.com` | Fallback |
| Invalid: control-character smuggling | `/\t/evil.com`, `/\n/evil.com` | Fallback (regression for DR-001) |
| Invalid: absolute or other scheme | `https://evil.com`, `javascript:alert(1)` | Fallback |
| Invalid: not a path | `dashboard`, `""`, `null`, `42` | Fallback |

## 2. Equivalence partitioning — composer routing (`src/lib/intent-routing.test.ts`)

Three classes × three languages (EN / FR / Darija): A) questions → coach; B) meal reports → meal parser; C) diary edits phrased as questions → meal parser. Partition C in French found DR-009 (infinitive verbs like *supprimer* weren't recognised).

## 3. Boundary value analysis — safety thresholds (`src/lib/coach/safety.boundaries.test.ts`)

Two-value BVA on each rule; the on-boundary result follows the rule's operator.

| Rule | Boundary | Values tested | Expected |
|---|---|---|---|
| Age gate | age < 18 blocks | 17 / 18 | blocked / allowed |
| Low BMI | BMI < 18.5 restricts | 59.9 kg / 59.94 kg at 180 cm | flag / no flag |
| Calorie floor | target ≤ 1200 restricts | 1200 / 1201 | flag / no flag |
| Very low intake | ≥ 5 days AND avg < 1000 | (5, 999) / (5, 1000) / (4, 600) | flag / no / no |
| Rapid loss | 7-day trend ≤ −1.5% body weight | −1.20 / −1.19 kg at 80 kg | flag / no flag |

## 4. Boundary value analysis — usage caps (`src/lib/ai-usage.test.ts`)

| Cap | Free | Premium | Values tested |
|---|---|---|---|
| Coach messages / day | 10 | 50 | 9 / 10, 49 / 50 |
| Coach messages / month | 10 | none | 9 / 10 |
| AI meal logs / day | 30 | 100 | 29 / 30, 99 / 100 |
| Custom env limit | — | — | limit 3: 2 / 3; limit 0 = unlimited |

Testing the two free defaults together showed the daily cap can never fire (OBS-1).

## 5. Decision table — premium access (`src/lib/entitlements.test.ts`)

| Rule | Row exists | Status | Period end | Lookup error | Premium |
|---|---|---|---|---|---|
| R1 | N | – | – | N | **No** |
| R2 | Y | active | none | N | **Yes** |
| R3 | Y | active | future | N | **Yes** |
| R4 | Y | active | past | N | **No** |
| R5 | Y | canceled | future | N | **No** |
| R6 | Y | past_due | none | N | **No** |
| R7 | Y | active | none | Y | **No** (fail closed) |

## 6. Decision table — coach access (route `src/app/api/coach/route.ts`)

Checked in this order; the first failing condition decides the response.

| # | Signed in | Coach enabled & spend under cap | Age ≥ 18 | Message valid | Under quota | Safety flags | Outcome |
|---|---|---|---|---|---|---|---|
| 1 | N | – | – | – | – | – | 401 `signIn` |
| 2 | Y | N | – | – | – | – | 503 `unavailable` |
| 3 | Y | Y | N | – | – | – | 403 `adultsOnly` |
| 4 | Y | Y | Y | N | – | – | 400 `empty` / `tooLong` |
| 5 | Y | Y | Y | Y | N | – | 429 `dailyLimit` / `monthlyLimit` |
| 6 | Y | Y | Y | Y | Y | none | Normal reply |
| 7 | Y | Y | Y | Y | Y | any | Reply in restricted mode |

Rules 3 and 6–7 are covered at component level (safety tests) and by the eval; the full table is the basis for the planned system tests.

## 7. State transition — beta access

**Waitlist entry**

```
(none) --join_waitlist--> waiting --admit_waitlist--> admitted --sign up with same email--> joined
waiting --sign up with an invite code (same email)--> joined
```

**Invite code** (`uses`, `max_uses`, `expires_at`)

```
valid (uses < max) --redeem--> valid | full (uses = max)
valid --time passes expires_at--> expired
full / expired --redeem--> rejected ("full" / "expired"), no state change
```

| ID | Start state | Event | Expected end state / result |
|---|---|---|---|
| ST-1 | no account access | redeem valid code | access granted, `uses+1`, premium for N days |
| ST-2 | code `uses = max−1` | redeem | access granted, code becomes full |
| ST-3 | code full | redeem | `full`, nothing granted |
| ST-4 | code expired | redeem | `expired`, nothing granted |
| ST-5 | user already has access | redeem | `already`, code use not consumed |
| ST-6 | waitlist `admitted` | user signs up with that email | access granted, entry → `joined` |
| ST-7 | waitlist `waiting` | user signs up | sent to `/invite` |
| ST-8 | user already premium longer than code grants | redeem | access granted, premium end date not shortened |

These run in SQL (`redeem_invite`, `claim_waitlist_access`, `admit_waitlist`); they are executed manually against the beta database today and are the first candidates for database-level automated tests.
