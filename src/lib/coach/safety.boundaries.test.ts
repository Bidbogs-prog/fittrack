import { describe, expect, it } from "vitest";
import { KCAL_FLOOR } from "@/lib/nutrition";
import { assessSafety, SAFETY, type SafetyInput } from "./safety";

/**
 * Boundary value analysis (2-value BVA) for every safety threshold. Each pair
 * sits on either side of the boundary; the on-boundary value's expected
 * outcome follows the rule's operator (<, <=, >=). These thresholds decide
 * whether the coach is blocked or restricted, so off-by-one errors here are
 * high-risk (see docs/qa/risk-register.md R1).
 */
const base: SafetyInput = {
  ageYears: 30,
  weightKg: 80,
  heightCm: 180,
  targetKcal: 2200,
  intake: { loggedDays: 10, avgKcal: 2100 },
  trendDelta7Kg: 0,
};
const flags = (patch: Partial<SafetyInput>) => assessSafety({ ...base, ...patch }).flags;

describe("age gate (blocked when age < 18)", () => {
  it("17 → blocked", () => expect(assessSafety({ ...base, ageYears: SAFETY.minAge - 1 }).blocked).toBe(true));
  it("18 → allowed", () => expect(assessSafety({ ...base, ageYears: SAFETY.minAge }).blocked).toBe(false));
});

describe("BMI (restricted when BMI < 18.5)", () => {
  // At 180 cm, BMI 18.5 ⇔ 59.94 kg.
  it("just under 18.5 → low_bmi", () => expect(flags({ weightKg: 59.9 })).toContain("low_bmi"));
  it("exactly 18.5 → no flag", () => expect(flags({ weightKg: 18.5 * 1.8 * 1.8 })).not.toContain("low_bmi"));
  it("missing height → BMI check skipped", () => expect(flags({ weightKg: 40, heightCm: null })).not.toContain("low_bmi"));
});

describe("calorie floor (restricted when target <= 1200)", () => {
  it("1200 → target_at_floor", () => expect(flags({ targetKcal: KCAL_FLOOR })).toContain("target_at_floor"));
  it("1201 → no flag", () => expect(flags({ targetKcal: KCAL_FLOOR + 1 })).not.toContain("target_at_floor"));
});

describe("very low intake (>= 5 logged days AND avg < 1000 kcal)", () => {
  it("5 days at 999 → flagged", () => expect(flags({ intake: { loggedDays: 5, avgKcal: 999 } })).toContain("very_low_intake"));
  it("5 days at 1000 → not flagged", () => expect(flags({ intake: { loggedDays: 5, avgKcal: 1000 } })).not.toContain("very_low_intake"));
  it("4 days at 600 → not flagged (too few days)", () => expect(flags({ intake: { loggedDays: 4, avgKcal: 600 } })).not.toContain("very_low_intake"));
  it("no intake data → not flagged", () => expect(flags({ intake: null })).not.toContain("very_low_intake"));
});

describe("rapid loss (7-day trend <= -1.5% of body weight)", () => {
  // 80 kg × 1.5% = 1.2 kg/week.
  it("-1.2 kg → rapid_loss", () => expect(flags({ trendDelta7Kg: -1.2 })).toContain("rapid_loss"));
  it("-1.19 kg → no flag", () => expect(flags({ trendDelta7Kg: -1.19 })).not.toContain("rapid_loss"));
  it("gain → no flag", () => expect(flags({ trendDelta7Kg: 1.5 })).not.toContain("rapid_loss"));
});

describe("outcome mapping", () => {
  it("any non-age flag → restricted, not blocked", () => {
    const a = assessSafety({ ...base, targetKcal: KCAL_FLOOR });
    expect(a).toMatchObject({ blocked: false, restricted: true });
  });
  it("underage with other flags → blocked, never 'restricted'", () => {
    const a = assessSafety({ ...base, ageYears: 16, targetKcal: KCAL_FLOOR });
    expect(a).toMatchObject({ blocked: true, restricted: false });
  });
});
