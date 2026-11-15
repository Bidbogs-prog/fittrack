import { REFERENCE_FOODS, type ReferenceFood } from "./compute";

/** A shared foods row for a reference food (per 100 g, as every food). */
export function referenceRow(r: ReferenceFood) {
  return {
    ref_key: r.key,
    source: "reference" as const,
    owner_id: null,
    name: r.name.fr,
    brand: null,
    category: r.category,
    state: r.state,
    aliases: [r.name.en, r.name.ar, ...r.aliases].join(" · ").slice(0, 1000),
    kcal: r.per100.kcal,
    protein_g: r.per100.protein_g,
    carbs_g: r.per100.carbs_g,
    fat_g: r.per100.fat_g,
    fibre_g: r.per100.fibre_g,
    sugar_g: r.per100.sugar_g,
    saturated_fat_g: r.per100.saturated_fat_g,
    serving_name: r.portion.label,
    serving_grams: r.portion.grams,
    ref_basis: `Calculated by So3ra from a standard home recipe with USDA FoodData Central ingredients. ${r.basis}`.slice(0, 1000),
  };
}

export const REFERENCE_ROWS = REFERENCE_FOODS.map(referenceRow);
