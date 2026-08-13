import type { CoachBrief } from "./types";

export const proteinMacros: CoachBrief = {
  id: "protein-macros",
  title: "Protein & macro ranges",
  keywords: [
    "protein",
    "macro",
    "macros",
    "carb",
    "carbs",
    "carbohydrate",
    "fat",
    "fats",
    "split",
    "grams per kg",
    "protéine",
    "protéines",
    "glucides",
    "lipides",
    "بروتين",
  ],
  lastReviewed: "2026-08-13",
  body: `Protein is the macro with the strongest evidence behind a hard target. For people doing resistance training, muscle-building benefit rises with intake up to roughly 1.6 g/kg/day, with the meta-analytic confidence interval extending to ~2.2 g/kg/day (Morton et al. 2018, Br J Sports Med) — the ISSN position stand lands on 1.4–2.0 g/kg for active people (Jäger et al. 2017, JISSN). While dieting, higher intakes (2.3–3.1 g/kg of lean mass) help preserve muscle in lean trainees (Helms et al. 2014, JISSN). The RDA of 0.8 g/kg is a minimum to avoid deficiency, not an optimum for body composition. Older adults do better at 1.0–1.2 g/kg minimum (PROT-AGE 2013). There is no meaningful "protein ceiling" concern in healthy people at these ranges, and spreading protein across 3–4 meals of ≥0.3 g/kg each is a reasonable, evidence-aligned habit rather than a rule.

Fat and carbohydrate are more flexible. Keep fat at or above ~0.5 g/kg/day (or 20–35% of calories, the IOM acceptable range) to protect hormone status and satiety; below that, adherence and wellbeing suffer. Carbohydrate then fills the remaining budget and should scale with training volume — hard training runs on carbs. FitTrack's default formula (protein per kg by goal, fat 25% of calories, carbs the remainder) sits inside all of these ranges, and custom splits are validated to sum to 100%.

Fibre: ~14 g per 1,000 kcal (IOM), which is exactly the app's fibre target.

Sources: Morton et al. 2018; Jäger et al. 2017 (ISSN); Helms et al. 2014; Bauer et al. 2013 (PROT-AGE); IOM Dietary Reference Intakes.`,
};
