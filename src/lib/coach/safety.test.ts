import { describe, expect, it } from "vitest";
import { assessSafety, bmi, type SafetyInput } from "./safety";

const healthy: SafetyInput = {
  ageYears: 30,
  weightKg: 80,
  heightCm: 180,
  targetKcal: 2200,
  intake: { loggedDays: 10, avgKcal: 2100 },
  trendDelta7Kg: -0.4,
};

describe("assessSafety", () => {
  it("passes a healthy adult with sane data", () => {
    const a = assessSafety(healthy);
    expect(a.flags).toEqual([]);
    expect(a.blocked).toBe(false);
    expect(a.restricted).toBe(false);
  });

  it("blocks minors entirely", () => {
    const a = assessSafety({ ...healthy, ageYears: 17 });
    expect(a.flags).toContain("underage");
    expect(a.blocked).toBe(true);
    expect(a.restricted).toBe(false);
  });

  it("restricts on BMI under 18.5", () => {
    // 55 kg at 180 cm ≈ BMI 17.0
    const a = assessSafety({ ...healthy, weightKg: 55 });
    expect(bmi(55, 180)).toBeLessThan(18.5);
    expect(a.flags).toContain("low_bmi");
    expect(a.restricted).toBe(true);
    expect(a.blocked).toBe(false);
  });

  it("skips the BMI check when height or weight is missing", () => {
    const a = assessSafety({ ...healthy, heightCm: null });
    expect(a.flags).not.toContain("low_bmi");
  });

  it("restricts when the target sits at the calorie floor", () => {
    const a = assessSafety({ ...healthy, targetKcal: 1200 });
    expect(a.flags).toContain("target_at_floor");
    expect(a.restricted).toBe(true);
  });

  it("restricts on sustained very low logged intake", () => {
    const a = assessSafety({ ...healthy, intake: { loggedDays: 6, avgKcal: 900 } });
    expect(a.flags).toContain("very_low_intake");
    expect(a.restricted).toBe(true);
  });

  it("ignores low intake with too few logged days (noise, not a pattern)", () => {
    const a = assessSafety({ ...healthy, intake: { loggedDays: 3, avgKcal: 700 } });
    expect(a.flags).not.toContain("very_low_intake");
  });

  it("restricts on rapid trend loss relative to body weight", () => {
    // 1.5% of 80 kg = 1.2 kg/week
    const a = assessSafety({ ...healthy, trendDelta7Kg: -1.3 });
    expect(a.flags).toContain("rapid_loss");
    expect(a.restricted).toBe(true);
  });

  it("does not flag normal loss rates", () => {
    const a = assessSafety({ ...healthy, trendDelta7Kg: -0.6 });
    expect(a.flags).not.toContain("rapid_loss");
  });

  it("collects multiple flags and stays blocked for flagged minors", () => {
    const a = assessSafety({
      ...healthy,
      ageYears: 16,
      weightKg: 50,
      targetKcal: 1200,
      intake: { loggedDays: 8, avgKcal: 800 },
    });
    expect(a.flags.length).toBeGreaterThan(1);
    expect(a.blocked).toBe(true);
    // blocked wins over restricted — the coach never answers at all
    expect(a.restricted).toBe(false);
  });
});
