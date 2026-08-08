import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calcBmr,
  calcTargets,
  calcTargetsWithTdee,
  ageFromBirthDate,
  type EnergyProfile,
} from "./nutrition";
import { weightTrend } from "./weight";
import type { Profile, WeightLog } from "./types";

/**
 * Adaptive TDEE (roadmap 1.2): instead of trusting the Mifflin-St Jeor
 * formula forever, derive the user's actual burn from what they logged
 * eating vs how their trend weight moved:
 *
 *   TDEE ≈ average intake − (Δ trend weight × 7700 kcal/kg) / days
 *
 * Estimates recalibrate weekly: the data window always ends on the Sunday
 * before the current week, so the target is stable within a week and
 * visibly updates each Monday. The static formula stays the cold-start
 * default until there's enough honest data (see thresholds below).
 */

/** Data window and quality gates for an estimate to be trusted. */
export const ADAPTIVE = {
  windowDays: 28,
  /** Weigh-ins must span at least this many days inside the window. */
  minSpanDays: 14,
  minLoggedDays: 10,
  minWeighIns: 5,
  kcalPerKgFat: 7700,
} as const;

export interface AdaptiveEstimate {
  /** Estimated daily burn, clamped to a physiological range around BMR. */
  tdee: number;
  /** Average kcal across logged days in the window. */
  intakeAvg: number;
  /** Trend-weight change over the span (negative = losing). */
  weightDeltaKg: number;
  /** Days between the first and last weigh-in used. */
  spanDays: number;
  loggedDays: number;
  weighIns: number;
  /** Monday the estimate took effect (start of the current week). */
  asOf: string;
}

function dateStr(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86_400_000
  );
}

/** Monday of the week containing `today` — the day estimates refresh. */
export function weekStart(today = new Date()): string {
  const d = new Date(today);
  d.setHours(12, 0, 0, 0);
  const shift = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - shift);
  return dateStr(d);
}

/**
 * Pure energy-balance estimate. `weights` should include ~2 months of
 * history before the window so the EWMA is warmed up; `intake` is per-day
 * kcal totals for logged days only. Returns null when the data doesn't
 * meet the quality gates.
 */
export function estimateTdee(input: {
  intake: { date: string; kcal: number }[];
  weights: WeightLog[];
  bmr: number;
  /** Monday of the current week; the window ends the day before. */
  asOf: string;
}): AdaptiveEstimate | null {
  const windowEnd = shiftDate(input.asOf, -1);
  const windowStart = shiftDate(windowEnd, -(ADAPTIVE.windowDays - 1));

  const points = weightTrend(input.weights.filter((w) => w.log_date <= windowEnd)).filter(
    (p) => p.date >= windowStart
  );
  if (points.length < ADAPTIVE.minWeighIns) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const spanDays = daysBetween(first.date, last.date);
  if (spanDays < ADAPTIVE.minSpanDays) return null;

  // Intake on the days that drove the weight change: first weigh-in day
  // inclusive, last exclusive. Unlogged days are assumed to look like the
  // logged average, which is why coverage below is required.
  const days = input.intake.filter(
    (d) => d.date >= first.date && d.date < last.date && d.kcal > 0
  );
  if (days.length < ADAPTIVE.minLoggedDays || days.length < spanDays / 2) return null;

  const intakeAvg = days.reduce((sum, d) => sum + d.kcal, 0) / days.length;
  const weightDeltaKg = last.trend - first.trend;
  const raw = intakeAvg - (weightDeltaKg * ADAPTIVE.kcalPerKgFat) / spanDays;

  // Underreported intake can push the estimate to implausible lows; keep
  // it in a physiological band around BMR rather than presenting noise.
  const tdee = Math.round(
    Math.min(Math.max(raw, input.bmr * 0.9), input.bmr * 2.5)
  );

  return {
    tdee,
    intakeAvg: Math.round(intakeAvg),
    weightDeltaKg: Math.round(weightDeltaKg * 100) / 100,
    spanDays,
    loggedDays: days.length,
    weighIns: points.length,
    asOf: input.asOf,
  };
}

export interface ActiveTargets {
  targets: EnergyProfile;
  /** Present when the targets are adaptive rather than formula-based. */
  adaptive: AdaptiveEstimate | null;
}

/**
 * The targets every surface should present: adaptive when the diary and
 * weight log support an estimate, otherwise the static formula. Returns
 * null only when the profile is missing onboarding fields.
 */
export async function getActiveTargets(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile
): Promise<ActiveTargets | null> {
  const fallback = calcTargets(profile);
  if (!fallback) return null;

  const asOf = weekStart();
  const windowEnd = shiftDate(asOf, -1);
  const fetchStart = shiftDate(windowEnd, -(ADAPTIVE.windowDays + 60));

  const [{ data: weightData }, { data: entryData }] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("log_date", fetchStart)
      .lte("log_date", windowEnd)
      .order("log_date"),
    supabase
      .from("diary_entries")
      .select("entry_date, grams, quick_kcal, food:foods(kcal)")
      .eq("user_id", userId)
      .gte("entry_date", shiftDate(windowEnd, -(ADAPTIVE.windowDays - 1)))
      .lte("entry_date", windowEnd),
  ]);

  const byDay = new Map<string, number>();
  for (const row of (entryData ?? []) as unknown as {
    entry_date: string;
    grams: number | null;
    quick_kcal: number | null;
    food: { kcal: number } | null;
  }[]) {
    const kcal =
      row.food != null && row.grams != null
        ? (row.food.kcal * row.grams) / 100
        : (row.quick_kcal ?? 0);
    byDay.set(row.entry_date, (byDay.get(row.entry_date) ?? 0) + kcal);
  }

  const bmr = calcBmr(
    profile.gender!,
    profile.weight_kg!,
    profile.height_cm!,
    ageFromBirthDate(profile.birth_date!)
  );
  const estimate = estimateTdee({
    intake: [...byDay.entries()].map(([date, kcal]) => ({ date, kcal })),
    weights: (weightData ?? []) as WeightLog[],
    bmr,
    asOf,
  });

  if (!estimate) return { targets: fallback, adaptive: null };
  const targets = calcTargetsWithTdee(profile, estimate.tdee);
  return targets ? { targets, adaptive: estimate } : { targets: fallback, adaptive: null };
}
