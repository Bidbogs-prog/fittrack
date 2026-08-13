import { KCAL_FLOOR } from "@/lib/nutrition";

/**
 * Deterministic risk flags for the AI coach (roadmap 1.6 C), computed
 * from the user's own data BEFORE any model call. The model never gets
 * to decide whether someone is at risk — these rules do.
 *
 * - `blocked`: the coach is unavailable entirely (minors).
 * - `restricted`: the coach answers, but in restricted mode — no deficit
 *   or restriction advice, supportive tone, signpost to professionals
 *   (the prompt block lives in the coach action).
 */

export type SafetyFlag =
  | "underage"
  | "low_bmi"
  | "target_at_floor"
  | "very_low_intake"
  | "rapid_loss";

export interface SafetyAssessment {
  flags: SafetyFlag[];
  blocked: boolean;
  restricted: boolean;
}

export const SAFETY = {
  minAge: 18,
  /** WHO underweight threshold. */
  minBmi: 18.5,
  /** Sustained-intake flag needs at least this many logged days... */
  lowIntakeMinDays: 5,
  /** ...averaging below this many kcal (clearly concerning if honest). */
  lowIntakeKcal: 1000,
  /** Trend loss faster than this share of body weight per week. */
  rapidLossPctPerWeek: 0.015,
} as const;

export interface SafetyInput {
  ageYears: number;
  weightKg: number | null;
  heightCm: number | null;
  /** Active daily calorie target (formula or adaptive). */
  targetKcal: number;
  /** Logged-day count and average intake across them, trailing window. */
  intake: { loggedDays: number; avgKcal: number } | null;
  /** EWMA trend-weight change over the trailing 7 days, kg (negative = loss). */
  trendDelta7Kg: number | null;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function assessSafety(input: SafetyInput): SafetyAssessment {
  const flags: SafetyFlag[] = [];

  if (input.ageYears < SAFETY.minAge) flags.push("underage");

  if (
    input.weightKg != null &&
    input.heightCm != null &&
    bmi(input.weightKg, input.heightCm) < SAFETY.minBmi
  ) {
    flags.push("low_bmi");
  }

  if (input.targetKcal <= KCAL_FLOOR) flags.push("target_at_floor");

  if (
    input.intake != null &&
    input.intake.loggedDays >= SAFETY.lowIntakeMinDays &&
    input.intake.avgKcal < SAFETY.lowIntakeKcal
  ) {
    flags.push("very_low_intake");
  }

  if (
    input.trendDelta7Kg != null &&
    input.weightKg != null &&
    input.trendDelta7Kg <= -(input.weightKg * SAFETY.rapidLossPctPerWeek)
  ) {
    flags.push("rapid_loss");
  }

  const blocked = flags.includes("underage");
  return { flags, blocked, restricted: !blocked && flags.length > 0 };
}
