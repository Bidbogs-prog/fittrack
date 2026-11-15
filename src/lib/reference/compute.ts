import { INGREDIENTS } from "./ingredients";
import { MOROCCAN_REFERENCE, type ReferenceRecipe } from "./moroccan";

/** Per-100 g composition of a reference recipe (see moroccan.ts). */
export interface ReferenceNutrition {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  /** null when any ingredient's value is unknown in the source data. */
  sugar_g: number | null;
  saturated_fat_g: number | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function rawWeight(recipe: ReferenceRecipe): number {
  return recipe.ingredients.reduce((s, [, g]) => s + g, 0);
}

export function computeRecipe(recipe: ReferenceRecipe): ReferenceNutrition {
  const total = recipe.cookedWeight ?? rawWeight(recipe);
  let kcal = 0, protein = 0, carbs = 0, fat = 0, fibre = 0;
  let sugar: number | null = 0;
  let sat: number | null = 0;
  for (const [key, grams] of recipe.ingredients) {
    const i = INGREDIENTS[key];
    const k = grams / 100;
    kcal += i.kcal * k;
    protein += i.protein * k;
    carbs += i.carbs * k;
    fat += i.fat * k;
    fibre += i.fibre * k;
    // Unknown counts only when the ingredient actually carries carbs/fat.
    sugar = sugar == null ? null : i.sugar == null ? (i.carbs * k > 0.5 ? null : sugar) : sugar + i.sugar * k;
    sat = sat == null ? null : i.satFat == null ? (i.fat * k > 0.5 ? null : sat) : sat + i.satFat * k;
  }
  const per = (v: number) => r1((v / total) * 100);
  return {
    kcal: Math.round((kcal / total) * 100),
    protein_g: per(protein),
    carbs_g: per(carbs),
    fat_g: per(fat),
    fibre_g: per(fibre),
    sugar_g: sugar == null ? null : per(sugar),
    saturated_fat_g: sat == null ? null : per(sat),
  };
}

export interface ReferenceFood extends ReferenceRecipe {
  per100: ReferenceNutrition;
}

export const REFERENCE_FOODS: ReferenceFood[] = MOROCCAN_REFERENCE.map((r) => ({ ...r, per100: computeRecipe(r) }));

export const REFERENCE_BY_KEY = new Map(REFERENCE_FOODS.map((r) => [r.key, r]));
