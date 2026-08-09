import { describe, expect, it } from "vitest";
import { trendDelta, weightTrend } from "./weight";
import type { WeightLog } from "./types";

function log(date: string, kg: number): WeightLog {
  return { id: date, user_id: "u1", log_date: date, weight_kg: kg };
}

describe("weightTrend (EWMA)", () => {
  it("starts at the first reading and smooths toward new ones", () => {
    const points = weightTrend([log("2026-08-01", 80), log("2026-08-02", 82)]);
    expect(points[0].trend).toBe(80);
    expect(points[1].trend).toBeCloseTo(80 + 0.3 * (82 - 80)); // alpha 0.3
  });

  it("sorts by date regardless of input order", () => {
    const points = weightTrend([log("2026-08-02", 82), log("2026-08-01", 80)]);
    expect(points[0].date).toBe("2026-08-01");
    expect(points[0].trend).toBe(80);
  });

  it("damps single-day spikes", () => {
    const points = weightTrend([
      log("2026-08-01", 80),
      log("2026-08-02", 83), // water weight
      log("2026-08-03", 80),
    ]);
    expect(points[1].trend).toBeLessThan(81); // spike absorbed, not followed
  });
});

describe("trendDelta", () => {
  it("needs at least two points", () => {
    expect(trendDelta(weightTrend([log("2026-08-01", 80)]))).toBeNull();
  });

  it("measures trend change against the closest point at the window edge", () => {
    const day = (i: number) => `2026-08-${String(i).padStart(2, "0")}`;
    const points = weightTrend(
      Array.from({ length: 10 }, (_, i) => log(day(i + 1), 80 - i * 0.2))
    );
    const delta = trendDelta(points, 7)!;
    expect(delta).toBeLessThan(0);
    const baseline = points.find((p) => p.date === day(3))!; // day 10 minus 7 days
    expect(delta).toBeCloseTo(points[9].trend - baseline.trend);
  });
});
