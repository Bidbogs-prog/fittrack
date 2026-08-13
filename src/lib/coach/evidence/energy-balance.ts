import type { CoachBrief } from "./types";

export const energyBalance: CoachBrief = {
  id: "energy-balance",
  title: "Energy balance & CICO",
  keywords: [
    "calorie",
    "calories",
    "kcal",
    "cico",
    "deficit",
    "surplus",
    "tdee",
    "metabolism",
    "metabolic",
    "energy balance",
    "burn",
    "déficit",
    "métabolisme",
    "سعرات",
  ],
  lastReviewed: "2026-08-13",
  body: `Body weight change is governed by energy balance: sustained intake below expenditure produces weight loss, above it weight gain. This is settled physiology (Hall & Guo 2017, Gastroenterology), but two practical caveats matter for coaching:

1. The relationship is dynamic, not linear. As weight drops, total expenditure drops with it (smaller body, less mass to move, some adaptive reduction), so a fixed deficit produces slowing loss over time — the old "3,500 kcal per pound forever" arithmetic overstates long-term results (Hall et al. 2011, Lancet; NIH Body Weight Planner). FitTrack's adaptive TDEE handles this by re-measuring expenditure from the user's own intake and trend weight; roughly 7,700 kcal corresponds to 1 kg of tissue change, which is the constant the app uses.

2. Expenditure is mostly invisible. Resting metabolism plus non-exercise movement dwarf workout burn for most people; exercise sessions of 200–400 kcal are real but small next to a 2,000+ kcal daily budget. Coaching should steer effort toward intake accuracy and daily movement, not "earning" food through workouts.

"Starvation mode" in the popular sense — eating too little to lose weight — is not supported: metabolic adaptation is real but modest (typically ~5–15% below predicted; Rosenbaum & Leibel 2010, Int J Obes), never enough to reverse a genuine deficit. Apparent stalls at very low reported intakes are far more often measurement drift: intake under-reporting averaged ~47% in the classic study of "diet-resistant" adults (Lichtman et al. 1992, NEJM).

Sources: Hall & Guo 2017; Hall et al. 2011; Rosenbaum & Leibel 2010; Lichtman et al. 1992.`,
};
