import { describe, expect, it } from "vitest";
import {
  ageFromBirthDate,
  calcBmr,
  calcTargets,
  calcTargetsWithTdee,
  calcTdee,
  calcWaterTargetMl,
  formatAmount,
  macrosForPortion,
  microsForPortion,
  percentDv,
  round1,
  sumMacros,
  sumMicros,
} from "./nutrition";
import { MICRO_KEYS, type Food, type MicroValues, type Profile } from "./types";

/** A complete profile; override per test. */
function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "u1",
    email: null,
    full_name: null,
    gender: "male",
    birth_date: "1996-01-15",
    height_cm: 180,
    weight_kg: 80,
    activity_level: "moderate",
    goal: "lose",
    protein_pct: null,
    carbs_pct: null,
    fat_pct: null,
    eating_window_start: null,
    eating_window_end: null,
    units: "metric",
    onboarded: true,
    ...overrides,
  };
}

const nullMicros = Object.fromEntries(MICRO_KEYS.map((k) => [k, null])) as MicroValues;

function food(overrides: Partial<Food> = {}): Food {
  return {
    ...nullMicros,
    id: "f1",
    name: "Test food",
    brand: null,
    barcode: null,
    source: "manual",
    category: "other",
    image_url: null,
    owner_id: null,
    serving_name: null,
    serving_grams: null,
    kcal: 100,
    protein_g: 10,
    carbs_g: 20,
    fat_g: 5,
    fibre_g: 2,
    ...overrides,
  };
}

describe("calcBmr (Mifflin-St Jeor)", () => {
  it("computes the male formula", () => {
    // 10*80 + 6.25*180 - 5*30 + 5
    expect(calcBmr("male", 80, 180, 30)).toBe(1780);
  });

  it("computes the female formula (-161 instead of +5)", () => {
    expect(calcBmr("female", 80, 180, 30)).toBe(1614);
  });
});

describe("calcTdee", () => {
  it("applies the activity multiplier", () => {
    expect(calcTdee(1780, "moderate")).toBe(Math.round(1780 * 1.55));
    expect(calcTdee(1780, "sedentary")).toBe(Math.round(1780 * 1.2));
  });
});

describe("calcTargets", () => {
  it("returns null while onboarding fields are missing", () => {
    expect(calcTargets(profile({ weight_kg: null }))).toBeNull();
    expect(calcTargets(profile({ birth_date: null }))).toBeNull();
    expect(calcTargets(profile({ activity_level: null }))).toBeNull();
  });

  it("derives kcal from TDEE plus the goal delta", () => {
    const p = profile({ goal: "lose" });
    const t = calcTargets(p)!;
    const age = ageFromBirthDate(p.birth_date!);
    const bmr = calcBmr("male", 80, 180, age);
    expect(t.bmr).toBe(bmr);
    expect(t.tdee).toBe(calcTdee(bmr, "moderate"));
    expect(t.kcal).toBe(t.tdee - 500);
  });

  it("uses the coach formula when no split is saved", () => {
    const t = calcTargets(profile({ goal: "lose" }))!;
    expect(t.protein).toBe(Math.round(2.2 * 80)); // lose = 2.2 g/kg
    expect(t.fat).toBe(Math.round((t.kcal * 0.25) / 9));
    expect(t.carbs).toBe(Math.max(0, Math.round((t.kcal - t.protein * 4 - t.fat * 9) / 4)));
  });

  it("honours a saved macro split", () => {
    const t = calcTargets(profile({ protein_pct: 30, carbs_pct: 40, fat_pct: 30 }))!;
    expect(t.protein).toBe(Math.round((t.kcal * 0.3) / 4));
    expect(t.carbs).toBe(Math.round((t.kcal * 0.4) / 4));
    expect(t.fat).toBe(Math.round((t.kcal * 0.3) / 9));
  });

  it("ignores a split that does not sum to 100", () => {
    const bad = calcTargets(profile({ protein_pct: 30, carbs_pct: 40, fat_pct: 20 }))!;
    const formula = calcTargets(profile())!;
    expect(bad.protein).toBe(formula.protein);
  });

  it("scales fibre at 14 g per 1000 kcal", () => {
    const t = calcTargets(profile())!;
    expect(t.fibre).toBe(Math.round((t.kcal / 1000) * 14));
  });
});

describe("calcTargetsWithTdee (adaptive)", () => {
  it("replaces the TDEE but keeps the profile BMR and goal delta", () => {
    const p = profile({ goal: "maintain" });
    const t = calcTargetsWithTdee(p, 3000)!;
    expect(t.tdee).toBe(3000);
    expect(t.kcal).toBe(3000);
    expect(t.bmr).toBe(calcTargets(p)!.bmr);
  });

  it("applies the 1200 kcal floor", () => {
    const t = calcTargetsWithTdee(profile({ goal: "lose" }), 1400)!;
    expect(t.kcal).toBe(1200);
  });
});

describe("portion scaling", () => {
  it("scales per-100 g facts linearly", () => {
    const m = macrosForPortion(food(), 150);
    expect(m.kcal).toBe(150);
    expect(m.protein).toBe(15);
    expect(m.fibre).toBe(3);
  });

  it("sums portions", () => {
    const total = sumMacros([macrosForPortion(food(), 100), macrosForPortion(food(), 50)]);
    expect(total.kcal).toBe(150);
    expect(total.carbs).toBe(30);
  });

  it("keeps unknown micros null when scaling", () => {
    const micros = microsForPortion(food({ sodium_mg: 200 }), 50);
    expect(micros.sodium_mg).toBe(100);
    expect(micros.iron_mg).toBeNull();
  });

  it("sums micros skipping unknowns; all-unknown stays null", () => {
    const total = sumMicros([
      microsForPortion(food({ sodium_mg: 200 }), 100),
      microsForPortion(food(), 100),
    ]);
    expect(total.sodium_mg).toBe(200); // second food unknown, not zero
    expect(total.iron_mg).toBeNull();
  });
});

describe("percentDv", () => {
  it("computes percent of the adult daily value", () => {
    expect(percentDv("sodium_mg", 1150)).toBe(50);
  });

  it("returns null for nutrients without a DV", () => {
    expect(percentDv("sugar_g", 30)).toBeNull();
  });
});

describe("calcWaterTargetMl", () => {
  it("defaults to 2 L without a weight", () => {
    expect(calcWaterTargetMl(null)).toBe(2000);
  });

  it("uses ~35 ml/kg rounded to a 250 ml glass", () => {
    expect(calcWaterTargetMl(80)).toBe(2750); // 2800 → 11.2 glasses → 11
  });

  it("clamps to a sane range", () => {
    expect(calcWaterTargetMl(30)).toBe(1500);
    expect(calcWaterTargetMl(150)).toBe(4000);
  });
});

describe("formatting", () => {
  it("round1 rounds to one decimal", () => {
    expect(round1(1.25)).toBe(1.3);
  });

  it("formatAmount uses fewer decimals as values grow", () => {
    expect(formatAmount(334.4)).toBe("334");
    expect(formatAmount(24.66)).toBe("24.7");
    expect(formatAmount(0.056)).toBe("0.06");
  });
});
