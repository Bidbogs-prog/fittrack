import { describe, expect, it } from "vitest";
import { parseRecipeFields } from "./recipe-form";
import { parseUserFood } from "./user-food";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const food = (extra: Record<string, string> = {}) =>
  parseUserFood(fd({ name: "Msemen", category: "carbs", kcal: "310", protein_g: "7", carbs_g: "45", fat_g: "11", fibre_g: "2", ...extra }));

describe("user food form (AUD-17)", () => {
  it("returns status keys, not English prose", () => {
    expect(food({ name: "M" })).toEqual({ error: "foodNameShort" });
    expect(food({ category: "pizza" })).toEqual({ error: "foodCategory" });
    expect(food({ barcode: "12ab" })).toEqual({ error: "barcodeDigits" });
    expect(food({ kcal: "901" })).toEqual({ error: "kcalPer100Range" });
    expect(food({ fat_g: "101" })).toEqual({ error: "macrosPer100Range" });
    expect(food({ serving_name: "1 piece" })).toEqual({ error: "servingPair" });
  });

  it("validates the serving weight that is stored, after rounding", () => {
    expect(food({ serving_name: "crumb", serving_grams: "0.04" })).toEqual({ error: "servingWeightRange" });
    expect(food({ serving_name: "piece", serving_grams: "0.96" })).toMatchObject({ values: { serving_grams: 1 } });
    expect(food({ serving_name: "piece", serving_grams: "5000.04" })).toMatchObject({ values: { serving_grams: 5000 } });
    expect(food({ serving_name: "piece", serving_grams: "5000.05" })).toEqual({ error: "servingWeightRange" });
  });
});

describe("recipe form", () => {
  it("validates rounded servings against 0.5–100", () => {
    expect(parseRecipeFields(fd({ name: "Tagine", servings: "0.44" }))).toEqual({ error: "recipeServingsRange" });
    expect(parseRecipeFields(fd({ name: "Tagine", servings: "0.45" }))).toMatchObject({ servings: 0.5 });
    expect(parseRecipeFields(fd({ name: "Tagine", servings: "100" }))).toMatchObject({ servings: 100 });
    expect(parseRecipeFields(fd({ name: "T", servings: "4" }))).toEqual({ error: "recipeNameShort" });
  });
});
