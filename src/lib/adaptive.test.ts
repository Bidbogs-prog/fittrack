import { describe, expect, it } from "vitest";
import { ADAPTIVE, estimateTdee, weekStart } from "./adaptive";
import { weightTrend } from "./weight";
import type { WeightLog } from "./types";

function shift(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

/** Daily weigh-ins from `start` for `count` days, linearly from → to kg. */
function dailyWeights(start: string, count: number, from: number, to: number): WeightLog[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `w${i}`,
    user_id: "u1",
    log_date: shift(start, i),
    weight_kg: Math.round((from + ((to - from) * i) / (count - 1)) * 10) / 10,
  }));
}

/** Constant daily intake covering [start, start+count). */
function dailyIntake(start: string, count: number, kcal: number) {
  return Array.from({ length: count }, (_, i) => ({ date: shift(start, i), kcal }));
}

const AS_OF = "2026-08-03"; // a Monday
const WINDOW_END = shift(AS_OF, -1);
const WINDOW_START = shift(WINDOW_END, -(ADAPTIVE.windowDays - 1));
const BMR = 1700;

describe("weekStart", () => {
  it("returns the Monday of the current week", () => {
    expect(weekStart(new Date("2026-08-05T15:00:00"))).toBe("2026-08-03"); // Wednesday
    expect(weekStart(new Date("2026-08-03T09:00:00"))).toBe("2026-08-03"); // Monday itself
    expect(weekStart(new Date("2026-08-09T23:00:00"))).toBe("2026-08-03"); // Sunday
  });
});

describe("estimateTdee", () => {
  it("recovers TDEE from energy balance", () => {
    const weights = dailyWeights(WINDOW_START, ADAPTIVE.windowDays, 80, 79);
    const intake = dailyIntake(WINDOW_START, ADAPTIVE.windowDays, 2200);
    const est = estimateTdee({ intake, weights, bmr: BMR, asOf: AS_OF })!;

    expect(est).not.toBeNull();
    // Expected from the same trend the estimator sees.
    const points = weightTrend(weights);
    const delta = points[points.length - 1].trend - points[0].trend;
    const span = ADAPTIVE.windowDays - 1;
    const expected = Math.round(2200 - (delta * ADAPTIVE.kcalPerKgFat) / span);
    expect(est.tdee).toBe(expected);
    expect(est.tdee).toBeGreaterThan(2200); // losing weight ⇒ burn above intake
    expect(est.weightDeltaKg).toBeLessThan(0);
    expect(est.spanDays).toBe(span);
    expect(est.asOf).toBe(AS_OF);
  });

  it("returns null with too few weigh-ins", () => {
    const weights = dailyWeights(WINDOW_START, ADAPTIVE.minWeighIns - 1, 80, 80);
    const intake = dailyIntake(WINDOW_START, ADAPTIVE.windowDays, 2200);
    expect(estimateTdee({ intake, weights, bmr: BMR, asOf: AS_OF })).toBeNull();
  });

  it("returns null when weigh-ins span fewer than the minimum days", () => {
    const weights = dailyWeights(WINDOW_START, ADAPTIVE.minSpanDays - 2, 80, 80);
    const intake = dailyIntake(WINDOW_START, ADAPTIVE.windowDays, 2200);
    expect(estimateTdee({ intake, weights, bmr: BMR, asOf: AS_OF })).toBeNull();
  });

  it("returns null with too few logged intake days", () => {
    const weights = dailyWeights(WINDOW_START, ADAPTIVE.windowDays, 80, 80);
    const intake = dailyIntake(WINDOW_START, ADAPTIVE.minLoggedDays - 1, 2200);
    expect(estimateTdee({ intake, weights, bmr: BMR, asOf: AS_OF })).toBeNull();
  });

  it("returns null when intake covers less than half the span", () => {
    // 27-day span but only 12 logged days (< 13.5).
    const weights = dailyWeights(WINDOW_START, ADAPTIVE.windowDays, 80, 80);
    const intake = dailyIntake(WINDOW_START, 12, 2200);
    expect(estimateTdee({ intake, weights, bmr: BMR, asOf: AS_OF })).toBeNull();
  });

  it("clamps implausibly low estimates to 0.9 x BMR", () => {
    // Massive underreporting: 500 kcal/day, weight flat.
    const weights = dailyWeights(WINDOW_START, ADAPTIVE.windowDays, 80, 80);
    const intake = dailyIntake(WINDOW_START, ADAPTIVE.windowDays, 500);
    const est = estimateTdee({ intake, weights, bmr: BMR, asOf: AS_OF })!;
    expect(est.tdee).toBe(Math.round(BMR * 0.9));
  });

  it("ignores weigh-ins on or after the asOf Monday", () => {
    const weights = [
      ...dailyWeights(WINDOW_START, ADAPTIVE.windowDays, 80, 80),
      // A wild reading on Monday itself must not shift the estimate.
      { id: "wx", user_id: "u1", log_date: AS_OF, weight_kg: 60 },
    ];
    const intake = dailyIntake(WINDOW_START, ADAPTIVE.windowDays, 2200);
    const est = estimateTdee({ intake, weights, bmr: BMR, asOf: AS_OF })!;
    expect(Math.abs(est.weightDeltaKg)).toBeLessThan(0.01);
  });

  it("only counts intake between the first and last weigh-in", () => {
    // Weigh-ins cover days 7..21 of the window (span 14); intake outside
    // that span (including a wild day before the first weigh-in) must not
    // count.
    const weighStart = shift(WINDOW_START, 7);
    const weights = dailyWeights(weighStart, 15, 80, 80);
    const intake = [
      { date: shift(WINDOW_START, 0), kcal: 9000 }, // before first weigh-in
      ...dailyIntake(weighStart, 14, 2000), // [first, last)
    ];
    const est = estimateTdee({ intake, weights, bmr: BMR, asOf: AS_OF })!;
    expect(est.intakeAvg).toBe(2000);
    expect(est.loggedDays).toBe(14);
  });
});
