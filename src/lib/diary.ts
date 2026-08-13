import {
  macrosForPortion,
  microsForPortion,
  sumMacros,
  sumMicros,
  type Macros,
} from "./nutrition";
import { MICRO_KEYS, type DiaryEntry, type MicroValues, type RecipeItem } from "./types";

/**
 * Diary entries come in two shapes (see DiaryEntry in types.ts): food
 * portions derive macros from per-100 g facts, snapshot entries (quick-add
 * and logged recipes) carry their macros directly. All diary math must go
 * through these helpers instead of assuming `entry.food` exists.
 */

export function isFoodEntry(entry: DiaryEntry): entry is DiaryEntry & {
  food: NonNullable<DiaryEntry["food"]>;
  grams: number;
} {
  return entry.food != null && entry.grams != null;
}

/**
 * The macro-bearing payload shared by diary entries and saved-meal items:
 * a food portion or a quick_* snapshot.
 */
export type MacroPayload = Pick<
  DiaryEntry,
  "food" | "grams" | "quick_kcal" | "quick_protein_g" | "quick_carbs_g" | "quick_fat_g" | "quick_fibre_g"
>;

export function entryMacros(entry: MacroPayload): Macros {
  if (entry.food != null && entry.grams != null) {
    return macrosForPortion(entry.food, entry.grams);
  }
  return {
    kcal: entry.quick_kcal ?? 0,
    protein: entry.quick_protein_g ?? 0,
    carbs: entry.quick_carbs_g ?? 0,
    fat: entry.quick_fat_g ?? 0,
    fibre: entry.quick_fibre_g ?? 0,
  };
}

/** Snapshot entries have no per-food facts: every micronutrient is unknown. */
export function entryMicros(entry: DiaryEntry): MicroValues {
  if (isFoodEntry(entry)) return microsForPortion(entry.food, entry.grams);
  return Object.fromEntries(MICRO_KEYS.map((k) => [k, null])) as MicroValues;
}

export function entryName(entry: Pick<DiaryEntry, "food" | "quick_name">): string {
  return entry.food?.name ?? entry.quick_name ?? "Quick add";
}

/** "150 g", "2 servings" or "quick add" — for list rows and coach prompts. */
export function entryAmountLabel(entry: DiaryEntry): string {
  if (entry.grams != null) return `${entry.grams} g`;
  if (entry.servings != null) {
    return Number(entry.servings) === 1 ? "1 serving" : `${Number(entry.servings)} servings`;
  }
  return "quick add";
}

/** Macros for a recipe's full ingredient list. */
export function recipeTotals(items: RecipeItem[]): Macros {
  return sumMacros(items.map((item) => macrosForPortion(item.food, item.grams)));
}

/** Macros for one serving of a recipe. */
export function recipePerServing(items: RecipeItem[], servings: number): Macros {
  const total = recipeTotals(items);
  const n = servings > 0 ? servings : 1;
  return {
    kcal: total.kcal / n,
    protein: total.protein / n,
    carbs: total.carbs / n,
    fat: total.fat / n,
    fibre: total.fibre / n,
  };
}

/** Summed micros across a recipe's ingredients (null = no data at all). */
export function recipeMicros(items: RecipeItem[]): MicroValues {
  return sumMicros(items.map((item) => microsForPortion(item.food, item.grams)));
}

/** Compact recipe shape served to the food picker (/api/foods/suggestions). */
export interface RecipeSuggestion {
  id: string;
  name: string;
  servings: number;
  itemCount: number;
  perServing: Macros;
}

/** Total macros for a saved meal's items (same two shapes as diary rows). */
export function savedMealTotals(items: MacroPayload[]): Macros {
  return sumMacros(items.map(entryMacros));
}

/** Compact saved-meal shape served to the food picker (/api/foods/suggestions). */
export interface SavedMealSuggestion {
  id: string;
  name: string;
  itemCount: number;
  itemNames: string[];
  total: Macros;
}
