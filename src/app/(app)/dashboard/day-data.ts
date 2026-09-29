import { cache } from "react";
import { redirect } from "next/navigation";
import { getActiveTargets } from "@/lib/adaptive";
import { getProfile } from "@/lib/auth";
import { entryMacros, entryMicros } from "@/lib/diary";
import { calcWaterTargetMl, sumMacros, sumMicros } from "@/lib/nutrition";
import { calcStreaks } from "@/lib/streak";
import type { DiaryEntry, ExerciseLog, WeightLog } from "@/lib/types";
import { trendDelta, weightTrend } from "@/lib/weight";
import type { DayInsights } from "./insights";

export function toDateString(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function parseDateParam(value: string | undefined, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

/**
 * Everything the orbit views need for one diary day: Today renders all of
 * it, Coach shares the dial summary and the right rail. cache() dedupes
 * within a request.
 */
export const getDayData = cache(async (date: string) => {
  const { supabase, userId, profile } = await getProfile();

  const active = await getActiveTargets(supabase, userId, profile);
  if (!active) redirect("/onboarding");
  const { targets, adaptive } = active;

  const today = toDateString(new Date());
  const yesterday = shiftDate(date, -1);

  const [
    { data: entriesData },
    { data: weightData },
    { data: yesterdayData },
    { data: savedInsight },
    { data: streakData },
    { data: waterData },
    { data: exerciseData },
    { data: stepData },
  ] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("*, food:foods(*)")
      .eq("user_id", userId)
      .eq("entry_date", date)
      .order("created_at"),
    supabase
      .from("weight_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("log_date", shiftDate(today, -120))
      .order("log_date"),
    supabase.from("diary_entries").select("id").eq("user_id", userId).eq("entry_date", yesterday).limit(1),
    supabase
      .from("ai_insights")
      .select("payload, updated_at")
      .eq("user_id", userId)
      .eq("scope", "day")
      .eq("period_start", date)
      .maybeSingle(),
    supabase
      .from("diary_entries")
      .select("entry_date")
      .eq("user_id", userId)
      .gte("entry_date", shiftDate(today, -219))
      .lte("entry_date", today),
    supabase.from("water_logs").select("ml").eq("user_id", userId).eq("log_date", date).maybeSingle(),
    supabase
      .from("exercise_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", date)
      .order("created_at"),
    supabase.from("step_logs").select("steps").eq("user_id", userId).eq("log_date", date).maybeSingle(),
  ]);

  const entries = (entriesData ?? []) as DiaryEntry[];
  const eaten = sumMacros(entries.map(entryMacros));
  const microTotals = sumMicros(entries.map(entryMicros));

  // Exercise raises the day's target only for formula targets: adaptive
  // TDEE already measures total burn, so crediting workouts would
  // double-count them.
  const exercises = (exerciseData ?? []) as ExerciseLog[];
  const burned = exercises.reduce((sum, e) => sum + e.kcal, 0);
  const kcalTarget = adaptive ? targets.kcal : targets.kcal + burned;
  const remaining = Math.round(kcalTarget - eaten.kcal);

  const trendPoints = weightTrend((weightData ?? []) as WeightLog[]);

  return {
    supabase,
    userId,
    profile,
    targets,
    adaptive,
    today,
    date,
    yesterday,
    isToday: date === today,
    entries,
    eaten,
    microTotals,
    exercises,
    burned,
    kcalTarget,
    remaining,
    trendPoints,
    weightDelta: trendDelta(trendPoints),
    streaks: calcStreaks(
      (streakData ?? []).map((r) => r.entry_date as string),
      today
    ),
    waterMl: (waterData?.ml as number | undefined) ?? 0,
    waterTarget: calcWaterTargetMl(profile.weight_kg),
    steps: (stepData?.steps as number | undefined) ?? null,
    yesterdayHasEntries: (yesterdayData ?? []).length > 0,
    savedInsight: savedInsight
      ? {
          payload: savedInsight.payload as DayInsights,
          updatedAt: savedInsight.updated_at as string,
        }
      : null,
  };
});

export type DayData = Awaited<ReturnType<typeof getDayData>>;

/** Macro-ring fractions (eaten / target, unclamped) for the orbit. */
export function ringFractions(data: DayData): [number, number, number] {
  const f = (eaten: number, target: number) => (target > 0 ? eaten / target : 0);
  return [
    f(data.eaten.protein, data.targets.protein),
    f(data.eaten.carbs, data.targets.carbs),
    f(data.eaten.fat, data.targets.fat),
  ];
}
