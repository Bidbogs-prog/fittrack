# Food data and AI estimation review — 13 November 2026

Read-only review of production `public.foods`, diary usage, and the AI meal parser (`src/app/(app)/dashboard/ai-log.ts`, `ai-log-prompt.ts`, `src/components/orbit/log-provider.tsx`). No data was changed.

## 1. What the database holds

| Measure | Value |
|---|---|
| Foods | 5,458 (5,456 shared, 2 private pending review) |
| Sources | Open Food Facts 5,146 · USDA 285 · So3ra manual 27 |
| Categories (shared) | snacks 1,855 · other 904 · dairy 758 · drinks 715 · carbs 511 · protein 256 · fats-nuts 254 · fruit 116 · vegetables 87 |
| With barcode / image | 5,149 / 5,089 |
| With a household serving | **2** |
| Names in Arabic script | 51 |
| Duplicate names (shared) | 323 names (e.g. Nutella ×17, ketchup ×5 from 97 to 520 kcal) |
| Diary use | 806 entries, 780 from library foods, 26 quick-adds |

The library is a packaged-product catalogue (OFF Morocco), not a food-composition table. That's right for barcodes and wrong for "what I cooked".

### Moroccan coverage

| Dish / staple | Shared rows |
|---|---|
| Harira | 1 — a **dry soup mix** (343 kcal/100 g) |
| Tagine (any) | 0 |
| Msemen, harcha | 1 each (manual) |
| Baghrir, batbout, khobz, meloui, rghaif, sfenj | 0 |
| Bissara, zaalouk, taktouka, loubia, rfissa, seffa, tanjia, pastilla, trid | 0 |
| Kefta, merguez | 0 |
| Atay (mint tea) | 0 |
| Sellou, chebakia, briouats, ghriba | 0 (1 packaged corne de gazelle) |
| Smen, khlii | 0 |
| Couscous | 23 — all **dry** semolina products, plus USDA cooked |
| Lben / raib, jben | 43 / 4 (good, packaged) |
| Chickpeas, lentils, dates | USDA generics only; "lentilles" returns a wheat-quinoa mix |

Prepared Moroccan food is essentially absent, so every home-cooked meal depends on the AI estimate.

### Data quality

| Check | Rows | Comment |
|---|---|---|
| kcal = 0 | 129 | Mostly tea, coffee, water (fine); 5 with real macros (e.g. "Sidi Ali" 4.2 g carbs) |
| Energy ≠ 4P+4C+9F by >20% | 134 | Many legitimate (vinegar, alcohol, polyols); >35%: 40 worth review |
| Macros sum > 100 g / 100 g | 46 | Impossible; data errors |
| Fibre = 0 | 2,933 | Usually "not declared", stored as 0 instead of unknown |
| Miscategorised | e.g. split-pea couscous, lentil-quinoa mix in "fats-nuts"; chickpeas in "vegetables" | Affects browsing and the coach |

Micronutrients (sodium, sugar, saturated fat) are present for ~95% of rows — better than expected.

## 2. AI estimation: how it works today

1. The model (Gemini via LLM Gateway) returns per item: name, portion, grams, kcal, protein, carbs, fat, fibre and a `search_query`, from memory. There is no reference table in the prompt.
2. The server searches the library with `search_query` (prefix, then substring, alphabetical) and attaches up to 3 matches.
3. **The confirm sheet pre-selects the first match over the AI's estimate** (`openSheet(..., matchFirst = true)`, `log-provider.tsx:239`).

### Finding F-1 (critical): the default match overrides a correct estimate with the wrong food

What the top match is for common inputs, from the live database:

| User says | Pre-selected | Problem |
|---|---|---|
| couscous | "Couscous" OFF, 354 kcal/100 g | dry semolina; cooked is ~112. 250 g plate logged as ~885 kcal instead of ~280 |
| harira | "Soupe marocaine Harira", 343 kcal/100 g | dry packet mix; a homemade bowl is ~60–90 kcal/100 g. 300 g bowl: ~1,030 vs ~240 kcal |
| oeuf | "Bouillon arôme boeuf", 210 kcal/100 g | substring match on "b**oeuf**" |
| lentilles | "blé et lentilles soja et Quinoa", 360 | dry mix, wrong food |
| riz | "Riz & blé complet - Fruits rouges", 374 | breakfast cereal, dry |
| pain | "Masa pizza", 309 | pizza dough |
| lait | Lait 45 ✓, then "Lait amandes" 525 | second option is wrong |

The AI's own number is usually in the right range; the match replaces it silently unless the user notices and switches. No harmful logs found in the diary yet (beta usage is mostly barcodes and staples), but it will hit every new user who types "couscous" or "harira".

### Other estimation gaps

- **F-2 No grounding for Moroccan dishes.** Values come from the model's memory; nothing anchors a bowl of harira or a msemen to a vetted reference. Results vary between calls and models.
- **F-3 No raw/dry vs cooked distinction** anywhere (prompt, search, data). This is the largest single source of error for grains and legumes (≈3×).
- **F-4 No server-side plausibility check.** The server accepts any kcal/macros up to 10,000 kcal; it doesn't check energy against 4/4/9, kcal per gram against the food type, or grams against a typical portion.
- **F-5 Portions.** Prompt says "conservative typical portions" with no Moroccan portion conventions (a bowl of harira, ¼ khobz, one msemen, a glass of atay with sugar). Photos have no size reference.
- **F-6 Hidden fat and sugar.** Oil in tagines, smen, butter on msemen, sugar in atay (often 2–4 sugar cubes per glass) are the main differences between "healthy-looking" and real intake; only "cooking oil folded in" is mentioned.
- **F-7 No measurement.** There's no accuracy eval for the parser; the coach has an eval, logging doesn't.

## 3. Improvement plan to professional grade

**P0 — stop the wrong defaults (small, do first)** — done 13 Nov (DR-050)
1. Pre-select a library match only when it fits: same state (dry vs prepared), energy density within ±30% of the AI's estimate per 100 g, and a name match on word boundaries ("oeuf" ≠ "boeuf"). Otherwise keep the estimate selected and show matches as alternatives.
2. Prompt: ask for `state` (raw/dry, cooked, prepared dish, drink) and make `search_query` say it ("couscous cuit", not "couscous").
3. Server checks on every estimate: energy vs 4P+4C+9F (+7 alcohol) within 15%, kcal/100 g within a range for the state, grams within a plausible portion; out of range → recompute or flag "check this".

**P1 — a vetted Moroccan reference table (the core of "professional grade")**
4. ~120 curated items with per-100 g values, a standard portion in household units, and a cited source: dishes (harira, tagines by protein, couscous 7 légumes, rfissa, seffa, pastilla, bissara, loubia, zaalouk, taktouka, kefta, tanjia, trid), breads (khobz, batbout, msemen, harcha, baghrir, meloui, rghaif, sfenj), sweets (chebakia, sellou, ghriba, kaab el ghzal, briouats), drinks (atay with 0/2/4 sugars, avocado/orange juice, nous-nous), fats (smen, khlii, argan, amlou), plus cooked staples (couscous, rice, lentils, chickpeas, white beans).
   - Sources, in order: Moroccan food composition data where it exists (Ministry of Health / INRA Maroc tables and published analyses of Moroccan dishes); FAO/INFOODS West African and Mediterranean tables; ANSES CIQUAL (France) for shared dishes; USDA FoodData Central for raw ingredients. Dishes without a published analysis are computed from a standard recipe (ingredient weights → cooked yield), documented per item.
   - Reviewed by a registered dietitian before going live; each row shows its source and review date.
5. Retrieval-grounded parsing: send the model the reference rows that match the description, have it return `{ref, grams}` for known dishes, and compute nutrition on the server from the reference. The model estimates only what isn't in the table, and that's labelled "estimate".
6. Portion units per item ("1 bol", "½ khobz", "1 msemen", "1 verre") so users and the model log in the units Moroccans actually use.

**P2 — clean the catalogue**
7. Flag (don't delete) the 46 impossible rows and the 40 with >35% energy mismatch; hide them from AI matching until reviewed.
8. Fibre "not declared" → unknown (null) instead of 0 on import.
9. Merge duplicates in search results (one row per name + energy band), import OFF serving sizes, fix category mapping for legumes and dry mixes.
10. Add `state` to foods (dry / cooked / ready-to-eat / drink) so search and matching can respect it.

**P3 — measure it**
11. A gold set of ~80 meal descriptions in Darija, French and English (plus 20 photos with weighed portions), with dietitian-computed values. Track median absolute % error for kcal and protein per item and per meal; gate prompt/model changes on it like the coach eval. Target: ≤15% median kcal error for reference dishes, ≤25% for free estimates.
12. In-app: users who correct grams or switch the match teach us where estimates miss (logged as anonymous events, no food content per the analytics rule — counts by reference id only).

**What "professional grade" means here:** every number has a source the user can see (reference table + citation, barcode label, or "AI estimate"), prepared dishes are computed from vetted data rather than recalled, impossible values can't be saved, and accuracy is measured against a dietitian-built test set on every change.
