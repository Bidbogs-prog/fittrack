import { describe, expect, it } from "vitest";
import { entryAmountLabel, entryMacros, entryMicros, entryName, recipePerServing } from "./diary";
import { MICRO_KEYS, type DiaryEntry, type Food, type MicroValues, type RecipeItem } from "./types";

const nullMicros = Object.fromEntries(MICRO_KEYS.map((k) => [k, null])) as MicroValues;

function food(overrides: Partial<Food> = {}): Food {
  return {
    ...nullMicros,
    id: "f1",
    name: "Rice",
    brand: null,
    barcode: null,
    source: "manual",
    category: "carbs",
    image_url: null,
    owner_id: null,
    serving_name: null,
    serving_grams: null,
    kcal: 130,
    protein_g: 2.7,
    carbs_g: 28,
    fat_g: 0.3,
    fibre_g: 0.4,
    sodium_mg: 1,
    ...overrides,
  };
}

function entry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: "e1",
    user_id: "u1",
    entry_date: "2026-08-09",
    meal: "lunch",
    food_id: null,
    grams: null,
    food: null,
    recipe_id: null,
    servings: null,
    quick_name: null,
    quick_kcal: null,
    quick_protein_g: null,
    quick_carbs_g: null,
    quick_fat_g: null,
    quick_fibre_g: null,
    ...overrides,
  };
}

describe("entryMacros", () => {
  it("derives food entries from per-100 g facts", () => {
    const e = entry({ food_id: "f1", food: food(), grams: 200 });
    expect(entryMacros(e).kcal).toBe(260);
    expect(entryMacros(e).carbs).toBe(56);
  });

  it("reads snapshot entries directly, missing macros as 0", () => {
    const e = entry({ quick_name: "Dinner out", quick_kcal: 700, quick_protein_g: 30 });
    const m = entryMacros(e);
    expect(m.kcal).toBe(700);
    expect(m.protein).toBe(30);
    expect(m.carbs).toBe(0);
  });
});

describe("entryMicros", () => {
  it("scales known micros for food entries", () => {
    const e = entry({ food_id: "f1", food: food(), grams: 200 });
    expect(entryMicros(e).sodium_mg).toBe(2);
    expect(entryMicros(e).iron_mg).toBeNull();
  });

  it("is all-unknown for snapshot entries", () => {
    const e = entry({ quick_name: "Quick", quick_kcal: 300 });
    expect(entryMicros(e).sodium_mg).toBeNull();
  });
});

describe("labels", () => {
  it("names entries from the food, quick label, or fallback", () => {
    expect(entryName(entry({ food: food() }))).toBe("Rice");
    expect(entryName(entry({ quick_name: "Tajine" }))).toBe("Tajine");
    expect(entryName(entry())).toBe("Quick add");
  });

  it("labels amounts by grams, servings, or quick add", () => {
    expect(entryAmountLabel(entry({ grams: 150 }))).toBe("150 g");
    expect(entryAmountLabel(entry({ servings: 2 }))).toBe("2 servings");
    expect(entryAmountLabel(entry({ servings: 1 }))).toBe("1 serving");
    expect(entryAmountLabel(entry())).toBe("quick add");
  });
});

describe("recipePerServing", () => {
  it("divides the ingredient total by servings", () => {
    const items: RecipeItem[] = [
      { id: "i1", recipe_id: "r1", food_id: "f1", grams: 300, food: food() },
      { id: "i2", recipe_id: "r1", food_id: "f2", grams: 100, food: food({ id: "f2", kcal: 900, protein_g: 0, carbs_g: 0, fat_g: 100, fibre_g: 0 }) },
    ];
    const per = recipePerServing(items, 4);
    expect(per.kcal).toBeCloseTo((130 * 3 + 900) / 4);
  });

  it("guards against zero servings", () => {
    const items: RecipeItem[] = [
      { id: "i1", recipe_id: "r1", food_id: "f1", grams: 100, food: food() },
    ];
    expect(recipePerServing(items, 0).kcal).toBe(130);
  });
});
