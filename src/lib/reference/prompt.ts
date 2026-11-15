import { REFERENCE_FOODS } from "./compute";

/**
 * The reference table as the meal parser sees it: one line per dish with
 * its key, names, per-100 g values and standard portion. Sent with every
 * parse (≈1.5k tokens) so the model can recognise dishes in any spelling
 * or from a photo and point at them instead of recalling numbers.
 */
export const REFERENCE_PROMPT_BLOCK = `SO3RA REFERENCE FOODS (Moroccan home cooking; per 100 g as eaten)
${REFERENCE_FOODS.map(
  (r) =>
    `${r.key} | ${r.name.fr} / ${r.name.ar} | ${r.per100.kcal} kcal, P ${r.per100.protein_g}, C ${r.per100.carbs_g}, F ${r.per100.fat_g} | ${r.portion.label} = ${r.portion.grams} g`
).join("\n")}`;
