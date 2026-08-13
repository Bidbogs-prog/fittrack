import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveTargets } from "@/lib/adaptive";
import { ACTIVITY_LEVELS, GOALS, ageFromBirthDate, round1 } from "@/lib/nutrition";
import { calcStreaks } from "@/lib/streak";
import { trendDelta, weightTrend } from "@/lib/weight";
import { MEAL_TYPES, type ExerciseLog, type Profile, type WeightLog } from "@/lib/types";
import { assessSafety, type SafetyAssessment } from "./safety";

/**
 * Compact user snapshot for the coach prompt (roadmap 1.6 A): profile,
 * active targets, trailing-14-day adherence, actual meals for today +
 * yesterday, a frequent-foods fingerprint, swap candidates from the food
 * library, weight trend, training and streaks — summarised to a bounded
 * token budget, never the full raw diary. Also computes the deterministic
 * safety assessment from the same data, so the two can never disagree.
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
  const yesterday = shiftDate(today, -1);
  const windowStart = shiftDate(today, -(WINDOW_DAYS - 1));

  const [
    { data: entryData },
    { data: weightData },
    { data: exerciseData },
    { data: streakData },
    { data: detailData },
    { data: favoriteData },
    { data: ownFoodData },
    { data: libraryData },
  ] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("entry_date, grams, quick_kcal, quick_protein_g, food:foods(name, kcal, protein_g)")
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
    // Actual meals for today + yesterday, food names included, so the
    // coach can talk about what was really eaten.
    supabase
      .from("diary_entries")
      .select(
        "entry_date, meal, grams, quick_name, quick_kcal, quick_protein_g, food:foods(name, brand, kcal, protein_g)"
      )
      .eq("user_id", userId)
      .in("entry_date", [yesterday, today])
      .order("created_at"),
    // Swap candidates the user can log directly: favourites first...
    supabase
      .from("favorite_foods")
      .select("food:foods(name, category, kcal, protein_g)")
      .eq("user_id", userId)
      .limit(15),
    // ...their own foods...
    supabase
      .from("foods")
      .select("name, category, kcal, protein_g")
      .eq("owner_id", userId)
      .limit(15),
    // ...and the curated global library (hand-seeded + USDA generics;
    // OFF's 5k branded rows are too noisy to sample blindly).
    supabase
      .from("foods")
      .select("name, category, kcal, protein_g")
      .is("owner_id", null)
      .in("source", ["manual", "usda"])
      .limit(400),
  ]);

  // Per-day kcal + protein across the window, derived the standard way
  // (per-100g scaling for foods, snapshots for quick adds) — plus a
  // frequency fingerprint of what the user actually eats.
  const byDay = new Map<string, { kcal: number; protein: number }>();
  const freq = new Map<string, { count: number; totalGrams: number }>();
  for (const row of (entryData ?? []) as unknown as {
    entry_date: string;
    grams: number | null;
    quick_kcal: number | null;
    quick_protein_g: number | null;
    food: { name: string; kcal: number; protein_g: number } | null;
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
    if (row.food != null && row.grams != null) {
      const f = freq.get(row.food.name) ?? { count: 0, totalGrams: 0 };
      f.count += 1;
      f.totalGrams += row.grams;
      freq.set(row.food.name, f);
    }
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

  // Meal-by-meal detail for today + yesterday, food names included.
  type DetailRow = {
    entry_date: string;
    meal: string;
    grams: number | null;
    quick_name: string | null;
    quick_kcal: number | null;
    quick_protein_g: number | null;
    food: { name: string; brand: string | null; kcal: number; protein_g: number } | null;
  };
  const detail = (detailData ?? []) as unknown as DetailRow[];
  const describeMeals = (date: string): string => {
    const rows = detail.filter((r) => r.entry_date === date);
    if (rows.length === 0) return "- nothing logged";
    return MEAL_TYPES.filter((meal) => rows.some((r) => r.meal === meal))
      .map((meal) => {
        const items = rows
          .filter((r) => r.meal === meal)
          .map((r) => {
            if (r.food != null && r.grams != null) {
              const kcal = Math.round((r.food.kcal * r.grams) / 100);
              const protein = Math.round((r.food.protein_g * r.grams) / 100);
              return `${r.food.name}${r.food.brand ? ` (${r.food.brand})` : ""} ${Math.round(r.grams)} g [${kcal} kcal, P ${protein} g]`;
            }
            return `${r.quick_name ?? "Quick add"} [${Math.round(r.quick_kcal ?? 0)} kcal, P ${Math.round(r.quick_protein_g ?? 0)} g]`;
          })
          .join(" · ");
        return `- ${meal}: ${items}`;
      })
      .join("\n");
  };

  const frequentLines =
    [...freq.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 12)
      .map(
        ([name, f]) =>
          `- ${name} ×${f.count}, typical ${Math.round(f.totalGrams / f.count)} g`
      )
      .join("\n") || "- not enough logged food data yet";

  // Swap candidates the user can log straight from the library: their
  // favourites and own foods verbatim, plus the curated seed foods per
  // category ranked protein-per-100-kcal (this is a protein-forward app).
  type LibRow = { name: string; category: string; kcal: number; protein_g: number };
  const favorites = ((favoriteData ?? []) as unknown as { food: LibRow | null }[])
    .map((r) => r.food)
    .filter((f): f is LibRow => f != null);
  const ownFoods = (ownFoodData ?? []) as LibRow[];
  const library = (libraryData ?? []) as LibRow[];
  const libFmt = (f: LibRow) => `${f.name} (${Math.round(f.kcal)} kcal, P ${round1(f.protein_g)} g)`;
  const byCategory = new Map<string, LibRow[]>();
  for (const f of library) {
    byCategory.set(f.category, [...(byCategory.get(f.category) ?? []), f]);
  }
  const libraryLines = [...byCategory.entries()]
    .map(([category, foods]) => {
      const top = foods
        .sort((a, b) => b.protein_g / Math.max(b.kcal, 1) - a.protein_g / Math.max(a.kcal, 1))
        .slice(0, 5);
      return `- ${category}: ${top.map(libFmt).join(" · ")}`;
    })
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

MEALS TODAY (${today}, in progress; portions with per-portion kcal and protein)
${describeMeals(today)}

MEALS YESTERDAY (${yesterday})
${describeMeals(yesterday)}

FOODS THEY EAT MOST (last ${WINDOW_DAYS} days)
${frequentLines}

FOOD LIBRARY SWAP CANDIDATES (all loggable in the app; per 100 g, ranked protein-dense first)
${favorites.length > 0 ? `Their favourites: ${favorites.map(libFmt).join(" · ")}\n` : ""}${
    ownFoods.length > 0 ? `Their own foods: ${ownFoods.map(libFmt).join(" · ")}\n` : ""
  }${libraryLines}

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
