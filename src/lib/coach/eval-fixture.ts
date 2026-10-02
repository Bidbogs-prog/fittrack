import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Shared by the coach evals (coach.eval.ts, compare.eval.ts). Never import from app code. */

// vitest doesn't read .env.local; the app's keys live there.
const envFile = path.join(process.cwd(), ".env.local");
if (existsSync(envFile) && !process.env.GEMINI_API_KEY) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// ---- fixture user: every number here is a ground truth for grading ----

// ---- fixture user: every number here is a ground truth for grading ----
export const FIXTURE_CONTEXT = `USER PROFILE
- Age 31, male, 84 kg (scale), 179 cm
- Activity: Moderately active · Goal: Lose weight
- Display units: metric · Fasting window: none

DAILY TARGETS (formula: Mifflin-St Jeor BMR 1802 kcal, TDEE 2703 kcal)
- 2200 kcal · protein 150 g · carbs 210 g · fat 61 g · fibre 31 g

LAST 14 DAYS (completed days only; today is still in progress)
- Logged 12 of 13 days · avg 2310 kcal vs 2200 target · avg protein 121 g vs 150 g target · avg fibre at least 19 g vs 31 g target (some foods lack fibre data)
- 2026-08-01: 2280 kcal, protein 118 g, fibre 17 g
- 2026-08-02: 2350 kcal, protein 125 g, fibre 21 g

MEALS TODAY (2026-08-13, in progress; portions with per-portion kcal and protein)
- breakfast: Oats 80 g [312 kcal, P 13 g] · Greek yogurt 0% 170 g [97 kcal, P 17 g]
- lunch: Chicken breast 150 g [248 kcal, P 47 g] · White rice cooked 200 g [260 kcal, P 5 g]

MEALS YESTERDAY (2026-08-12)
- dinner: Pasta Skruer 120 g [430 kcal, P 14 g] · Cucina Cooking Cream 500ml 40 g [104 kcal, P 1 g]

FOODS THEY EAT MOST (last 14 days)
- Chicken breast ×9, typical 150 g
- Oats ×8, typical 80 g
- Pasta Skruer ×6, typical 110 g

FOOD LIBRARY SWAP CANDIDATES (all loggable in the app; per 100 g, ranked protein-dense first)
Their favourites: Greek yogurt 0% (57 kcal, P 10.2 g) · Eggs (143 kcal, P 12.6 g)
- protein: Cod, baked (105 kcal, P 22.8 g) · Tuna canned in water (116 kcal, P 25.5 g) · Turkey breast (135 kcal, P 29.9 g) · Lentils cooked (116 kcal, P 9 g)
- dairy: Cottage cheese 2% (84 kcal, P 11 g) · Skyr (63 kcal, P 11 g)
- carbs: Quinoa cooked (120 kcal, P 4.4 g) · Whole wheat pasta cooked (124 kcal, P 5.3 g)

WEIGHT
- Trend weight 84.2 kg (last weigh-in 2026-08-13) · 7-day change -0.4 kg · 30-day change -1.6 kg

TRAINING (last 14 days)
- 5 workouts across 5 days, 1850 kcal total

CONSISTENCY
- Current logging streak 9 days · 86% of the last 30 days logged`;
