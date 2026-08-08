import type { WeightLog } from "./types";

export interface TrendPoint {
  date: string;
  /** Raw scale reading for the day. */
  weight: number;
  /** Exponentially weighted moving average up to this day. */
  trend: number;
}

/**
 * Smooth daily weigh-ins with an exponentially weighted moving average.
 * Raw readings swing 1–2 kg with water and glycogen; the EWMA is what the
 * UI should present as "your weight" (alpha 0.3 ≈ a ~1-week half-life at
 * daily logging). Also the input for adaptive TDEE later (roadmap P1.2).
 */
export function weightTrend(logs: WeightLog[], alpha = 0.3): TrendPoint[] {
  const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
  let trend: number | null = null;
  return sorted.map((log) => {
    const weight = Number(log.weight_kg);
    trend = trend == null ? weight : trend + alpha * (weight - trend);
    return { date: log.log_date, weight, trend };
  });
}

/**
 * Change in trend weight over roughly the trailing `days` window, or null
 * with fewer than two points. Uses the closest logged day at the window
 * edge, so sparse loggers still get an honest reading.
 */
export function trendDelta(points: TrendPoint[], days = 7): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const cutoff = new Date(last.date + "T12:00:00");
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const baseline =
    [...points].reverse().find((p) => p.date <= cutoffStr) ?? points[0];
  if (baseline.date === last.date) return null;
  return last.trend - baseline.trend;
}
