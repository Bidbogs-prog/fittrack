import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveTargets } from "@/lib/adaptive";
import { ACTIVITY_LEVELS, GOALS, ageFromBirthDate, round1 } from "@/lib/nutrition";
import { calcStreaks } from "@/lib/streak";
import { trendDelta, weightTrend } from "@/lib/weight";
import type { ExerciseLog, Profile, WeightLog } from "@/lib/types";
import { assessSafety, type SafetyAssessment } from "./safety";

/**
 * Compact user snapshot for the coach prompt (roadmap 1.6 A): profile,
 * active targets, trailing-14-day adherence, weight trend, training and
 * streaks — summarised to a small token budget, never the raw diary.
 * Also computes the deterministic safety assessment from the same data,
 * so the two can never disagree.
 */

export interface CoachContext {
  context: string;
  safety: SafetyAssessment;
}

function dateStr(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

const WINDOW_DAYS = 14;

export async function buildCoachContext(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
  active: ActiveTargets
): Promise<CoachContext> {
  const today = dateStr(new Date());
  const windowStart = shiftDate(today, -(WINDOW_DAYS - 1));

  const [{ data: entryData }, { data: weightData }, { data: exerciseData }, { data: streakData }] =
    await Promise.all([
      supabase
        .from("diary_entries")
        .select("entry_date, grams, quick_kcal, quick_protein_g, food:foods(kcal, protein_g)")
        .eq("user_id", userId)
        .gte("entry_date", windowStart)
        .lte("entry_date", today),
      supabase
        .from("weight_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", shiftDate(today, -120))
        .order("log_date"),
      supabase
        .from("exercise_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", windowStart)
        .order("log_date"),
      supabase
        .from("diary_entries")
        .select("entry_date")
        .eq("user_id", userId)
        .gte("entry_date", shiftDate(today, -60))
        .lte("entry_date", today),
    ]);

  // Per-day kcal + protein across the window, derived the standard way
  // (per-100g scaling for foods, snapshots for quick adds).
  const byDay = new Map<string, { kcal: number; protein: number }>();
  for (const row of (entryData ?? []) as unknown as {
    entry_date: string;
    grams: number | null;
    quick_kcal: number | null;
    quick_protein_g: number | null;
    food: { kcal: number; protein_g: number } | null;
  }[]) {
    const kcal =
      row.food != null && row.grams != null
        ? (row.food.kcal * row.grams) / 100
        : (row.quick_kcal ?? 0);
    const protein =
      row.food != null && row.grams != null
        ? (row.food.protein_g * row.grams) / 100
        : (row.quick_protein_g ?? 0);
    const day = byDay.get(row.entry_date) ?? { kcal: 0, protein: 0 };
    day.kcal += kcal;
    day.protein += protein;
    byDay.set(row.entry_date, day);
  }

  const { targets, adaptive } = active;
  // Today is usually mid-logging; judge adherence on completed days only.
  const completed = [...byDay.entries()]
    .filter(([date, day]) => date !== today && day.kcal > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const loggedDays = completed.length;
  const avgKcal =
    loggedDays > 0 ? completed.reduce((sum, [, d]) => sum + d.kcal, 0) / loggedDays : 0;
  const avgProtein =
    loggedDays > 0 ? completed.reduce((sum, [, d]) => sum + d.protein, 0) / loggedDays : 0;

  const trendPoints = weightTrend((weightData ?? []) as WeightLog[]);
  const latestTrend = trendPoints.at(-1);
  const delta7 = trendDelta(trendPoints, 7);
  const delta30 = trendDelta(trendPoints, 30);

  const exercises = (exerciseData ?? []) as ExerciseLog[];
  const exerciseDays = new Set(exercises.map((e) => e.log_date)).size;
  const exerciseKcal = exercises.reduce((sum, e) => sum + e.kcal, 0);

  const streaks = calcStreaks(
    ((streakData ?? []) as { entry_date: string }[]).map((r) => r.entry_date),
    today
  );

  const age = ageFromBirthDate(profile.birth_date!);
  const safety = assessSafety({
    ageYears: age,
    weightKg: latestTrend?.trend ?? profile.weight_kg,
    heightCm: profile.height_cm,
    targetKcal: targets.kcal,
    intake: loggedDays > 0 ? { loggedDays, avgKcal } : null,
    trendDelta7Kg: delta7,
  });

  const dayLines =
    completed.length === 0
      ? "- nothing logged in the window"
      : completed
          .map(
            ([date, d]) =>
              `- ${date}: ${Math.round(d.kcal)} kcal, protein ${Math.round(d.protein)} g`
          )
          .join("\n");

  const fasting =
    profile.eating_window_start && profile.eating_window_end
      ? `${profile.eating_window_start.slice(0, 5)}–${profile.eating_window_end.slice(0, 5)}`
      : "none";

  const context = `USER PROFILE
- Age ${age}, ${profile.gender}, ${profile.weight_kg} kg (scale), ${profile.height_cm} cm
- Activity: ${ACTIVITY_LEVELS[profile.activity_level!].label} · Goal: ${GOALS[targets.goal].label}
- Display units: ${profile.units} · Fasting window: ${fasting}

DAILY TARGETS (${
    adaptive
      ? `adaptive: TDEE ${targets.tdee} kcal measured over ${adaptive.spanDays} days from their own intake vs weight trend`
      : `formula: Mifflin-St Jeor BMR ${targets.bmr} kcal, TDEE ${targets.tdee} kcal`
  })
- ${targets.kcal} kcal · protein ${targets.protein} g · carbs ${targets.carbs} g · fat ${targets.fat} g · fibre ${targets.fibre} g

LAST ${WINDOW_DAYS} DAYS (completed days only; today is still in progress)
- Logged ${loggedDays} of ${WINDOW_DAYS - 1} days · avg ${Math.round(avgKcal)} kcal vs ${targets.kcal} target · avg protein ${Math.round(avgProtein)} g vs ${targets.protein} g target
${dayLines}

WEIGHT
- ${
    latestTrend
      ? `Trend weight ${round1(latestTrend.trend)} kg (last weigh-in ${latestTrend.date})` +
        (delta7 != null ? ` · 7-day change ${round1(delta7)} kg` : "") +
        (delta30 != null ? ` · 30-day change ${round1(delta30)} kg` : "")
      : "No weigh-ins yet"
  }

TRAINING (last ${WINDOW_DAYS} days)
- ${
    exercises.length === 0
      ? "No workouts logged"
      : `${exercises.length} workouts across ${exerciseDays} days, ${exerciseKcal} kcal total`
  }

CONSISTENCY
- Current logging streak ${streaks.current} days · ${streaks.consistency30}% of the last 30 days logged`;

  return { context, safety };
}
