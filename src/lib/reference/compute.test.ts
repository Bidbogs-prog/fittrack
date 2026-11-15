import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "./ingredients";
import { REFERENCE_FOODS, rawWeight } from "./compute";
import { MOROCCAN_REFERENCE } from "./moroccan";

describe("Moroccan reference table", () => {
  it("keys are unique and every ingredient exists", () => {
    const keys = MOROCCAN_REFERENCE.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of MOROCCAN_REFERENCE) for (const [k] of r.ingredients) expect(INGREDIENTS[k], `${r.key}: ${k}`).toBeDefined();
  });

  it.each(REFERENCE_FOODS.map((r) => [r.key, r] as const))("%s: energy matches 4/4/9 within 10%", (_, r) => {
    // USDA uses food-specific Atwater factors (vegetables < 4 kcal/g carbs),
    // so general 4/4/9 runs up to ~9% high on vegetable dishes.
    const atw = 4 * r.per100.protein_g + 4 * r.per100.carbs_g + 9 * r.per100.fat_g;
    if (r.per100.kcal >= 10) expect(Math.abs(r.per100.kcal - atw) / r.per100.kcal).toBeLessThan(0.1);
  });

  it.each(REFERENCE_FOODS.map((r) => [r.key, r] as const))("%s: plausible cooked weight and density", (_, r) => {
    // Cooking can lose water (and frying adds oil already listed), but never
    // more than ~50% of the batch (fries); grains gain water.
    const raw = rawWeight(r);
    const cooked = r.cookedWeight ?? raw;
    expect(cooked / raw).toBeGreaterThan(0.5);
    expect(cooked / raw).toBeLessThan(2.6);
    expect(r.per100.kcal).toBeLessThanOrEqual(900);
    expect(r.per100.protein_g + r.per100.carbs_g + r.per100.fat_g).toBeLessThanOrEqual(100);
    expect(r.portion.grams).toBeGreaterThan(0);
  });

  it("matches published ranges for the anchors (kcal per 100 g)", () => {
    const k = (key: string) => REFERENCE_FOODS.find((r) => r.key === key)!.per100.kcal;
    // Ranges from CIQUAL / USDA equivalents and published analyses of the dish.
    expect(k("harira")).toBeGreaterThanOrEqual(50);
    expect(k("harira")).toBeLessThanOrEqual(90);
    expect(k("khobz")).toBeGreaterThanOrEqual(240); // white bread / pita 250–275
    expect(k("khobz")).toBeLessThanOrEqual(285);
    expect(k("couscous_7_legumes")).toBeGreaterThanOrEqual(110);
    expect(k("couscous_7_legumes")).toBeLessThanOrEqual(170);
    expect(k("msemen")).toBeGreaterThanOrEqual(300);
    expect(k("msemen")).toBeLessThanOrEqual(380);
    expect(k("chebakia")).toBeGreaterThanOrEqual(430);
    expect(k("chebakia")).toBeLessThanOrEqual(520);
    expect(k("atay_sucre")).toBeGreaterThanOrEqual(15);
    expect(k("atay_sucre")).toBeLessThanOrEqual(35);
  });
});
