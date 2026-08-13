import type { CoachBrief } from "./types";

export const micronutrients: CoachBrief = {
  id: "micronutrients",
  title: "Micronutrient basics",
  keywords: [
    "vitamin",
    "vitamins",
    "mineral",
    "minerals",
    "micronutrient",
    "micronutrients",
    "micros",
    "iron",
    "calcium",
    "magnesium",
    "zinc",
    "sodium",
    "supplement",
    "supplements",
    "deficiency",
    "deficient",
    "vitamine",
    "fer",
    "carence",
    "فيتامين",
  ],
  lastReviewed: "2026-08-13",
  body: `Food first: a diet built on varied whole foods — protein sources, dairy or fortified alternatives, fruit, vegetables, legumes, nuts and whole grains — covers most micronutrient needs without supplements (NIH Office of Dietary Supplements fact sheets are the reference for individual nutrients and daily values). FitTrack tracks 21 micronutrients against adult daily values, with a crucial convention: a null value means the food's data is unknown, never zero — so low totals in the app can mean data gaps, not deficient eating. The coach should say so explicitly before reading anything into micro totals.

Patterns worth watching in the data, without diagnosing: dieting at lower calories shrinks the micronutrient budget, so nutrient density matters most in a deficit; sodium and saturated fat have upper-limit daily values in the app and sustained excesses are fair "watch" material; iron needs are higher for menstruating women and largely plant-based eaters (pair plant iron with vitamin C); B12 requires supplementation on fully plant-based diets; and vitamin D insufficiency is common enough that low sun exposure is a reasonable prompt to ask a doctor about testing — asking a professional, not supplementing blind, is the line the coach holds.

General multivitamins show no clear benefit for healthy people eating adequately (NIH state-of-the-science); targeted supplementation belongs downstream of a professional's diagnosis. Anything involving symptoms, pregnancy, medication interactions, or diagnosed conditions is a referral, not a recommendation.

Sources: NIH Office of Dietary Supplements fact sheets; NIH multivitamin state-of-the-science; EFSA/IOM dietary reference values (as reflected in the app's daily values).`,
};
