"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { recipePerServing } from "@/lib/diary";
import { round1 } from "@/lib/nutrition";
import { MEAL_TYPES, type MealType, type RecipeItem } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Optional macro field: "" = unknown (null), otherwise a bounded number. */
function parseOptionalMacro(formData: FormData, name: string): number | null | "invalid" {
  const raw = formData.get(name);
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return n >= 0 && n <= 2000 ? round1(n) : "invalid";
}

export async function addDiaryEntry(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const foodId = String(formData.get("food_id") ?? "");
  const meal = String(formData.get("meal") ?? "") as MealType;
  const entryDate = String(formData.get("entry_date") ?? "");
  const grams = Number(formData.get("grams"));

  if (!foodId || !MEAL_TYPES.includes(meal) || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return { error: "Invalid entry." };
  }
  if (!(grams > 0 && grams <= 5000)) {
    return { error: "Grams must be between 1 and 5000." };
  }

  const { error } = await supabase.from("diary_entries").insert({
    user_id: userId,
    food_id: foodId,
    meal,
    entry_date: entryDate,
    grams,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

/** Quick-add: log calories (and optional macros) without picking a food. */
export async function addQuickEntry(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const meal = String(formData.get("meal") ?? "") as MealType;
  const entryDate = String(formData.get("entry_date") ?? "");
  const name = String(formData.get("quick_name") ?? "").trim().slice(0, 80) || "Quick add";
  const kcal = Number(formData.get("quick_kcal"));

  if (!MEAL_TYPES.includes(meal) || !DATE_RE.test(entryDate)) {
    return { error: "Invalid entry." };
  }
  if (!(kcal >= 0 && kcal <= 10000)) {
    return { error: "Calories must be between 0 and 10000." };
  }

  const macros: Record<string, number | null> = {};
  for (const key of ["quick_protein_g", "quick_carbs_g", "quick_fat_g", "quick_fibre_g"]) {
    const value = parseOptionalMacro(formData, key);
    if (value === "invalid") return { error: "Macros must be between 0 and 2000 g." };
    macros[key] = value;
  }

  const { error } = await supabase.from("diary_entries").insert({
    user_id: userId,
    meal,
    entry_date: entryDate,
    quick_name: name,
    quick_kcal: round1(kcal),
    ...macros,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

/**
 * Log a recipe as one unit. Macros are snapshotted at log time (recipe
 * edits must not rewrite diary history); recipe_id + servings stay for
 * display and re-editing the portion.
 */
export async function addRecipeEntry(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const recipeId = String(formData.get("recipe_id") ?? "");
  const meal = String(formData.get("meal") ?? "") as MealType;
  const entryDate = String(formData.get("entry_date") ?? "");
  const servings = Number(formData.get("servings"));

  if (!recipeId || !MEAL_TYPES.includes(meal) || !DATE_RE.test(entryDate)) {
    return { error: "Invalid entry." };
  }
  if (!(servings > 0 && servings <= 100)) {
    return { error: "Servings must be between 0.1 and 100." };
  }

  const { data: recipe } = await supabase
    .from("recipes")
    .select("*, items:recipe_items(*, food:foods(*))")
    .eq("id", recipeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!recipe) return { error: "Recipe not found." };

  const items = (recipe.items ?? []) as RecipeItem[];
  if (items.length === 0) return { error: "This recipe has no ingredients yet." };

  const per = recipePerServing(items, Number(recipe.servings));
  const { error } = await supabase.from("diary_entries").insert({
    user_id: userId,
    meal,
    entry_date: entryDate,
    recipe_id: recipeId,
    servings,
    quick_name: recipe.name,
    quick_kcal: round1(per.kcal * servings),
    quick_protein_g: round1(per.protein * servings),
    quick_carbs_g: round1(per.carbs * servings),
    quick_fat_g: round1(per.fat * servings),
    quick_fibre_g: round1(per.fibre * servings),
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

/** Edit-in-place: meal + portion for food entries, label/macros for snapshots. */
export async function updateDiaryEntry(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const meal = String(formData.get("meal") ?? "") as MealType;
  if (!id || !MEAL_TYPES.includes(meal)) return { error: "Invalid entry." };

  const { data: existing } = await supabase
    .from("diary_entries")
    .select("id, food_id, recipe_id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return { error: "Entry not found." };

  const patch: Record<string, unknown> = { meal };
  if (existing.food_id) {
    const grams = Number(formData.get("grams"));
    if (!(grams > 0 && grams <= 5000)) {
      return { error: "Grams must be between 1 and 5000." };
    }
    patch.grams = grams;
  } else {
    const kcal = Number(formData.get("quick_kcal"));
    if (!(kcal >= 0 && kcal <= 10000)) {
      return { error: "Calories must be between 0 and 10000." };
    }
    patch.quick_name =
      String(formData.get("quick_name") ?? "").trim().slice(0, 80) || "Quick add";
    patch.quick_kcal = round1(kcal);
    for (const key of ["quick_protein_g", "quick_carbs_g", "quick_fat_g", "quick_fibre_g"]) {
      const value = parseOptionalMacro(formData, key);
      if (value === "invalid") return { error: "Macros must be between 0 and 2000 g." };
      patch[key] = value;
    }
  }

  const { error } = await supabase
    .from("diary_entries")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

/** Copy a previous day's entries (optionally one meal) into another date. */
export async function copyDiaryEntries(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const fromDate = String(formData.get("from_date") ?? "");
  const toDate = String(formData.get("to_date") ?? "");
  const mealRaw = String(formData.get("meal") ?? "");
  const meal = MEAL_TYPES.includes(mealRaw as MealType) ? (mealRaw as MealType) : null;

  if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate) || fromDate === toDate) return;

  let query = supabase
    .from("diary_entries")
    .select(
      "meal, food_id, grams, recipe_id, servings, quick_name, quick_kcal, quick_protein_g, quick_carbs_g, quick_fat_g, quick_fibre_g"
    )
    .eq("user_id", userId)
    .eq("entry_date", fromDate)
    .order("created_at");
  if (meal) query = query.eq("meal", meal);

  const { data: rows } = await query;
  if (!rows || rows.length === 0) return;

  await supabase
    .from("diary_entries")
    .insert(rows.map((row) => ({ ...row, user_id: userId, entry_date: toDate })));

  revalidatePath("/dashboard");
}

/**
 * Snapshot one meal's diary rows as a named saved meal for one-tap
 * re-logging on other days. Later edits to the diary never touch it.
 */
export async function saveMealAsGroup(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const fromDate = String(formData.get("from_date") ?? "");
  const meal = String(formData.get("meal") ?? "") as MealType;
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);

  if (!DATE_RE.test(fromDate) || !MEAL_TYPES.includes(meal)) {
    return { error: "Invalid request." };
  }
  if (!name) return { error: "Give the meal a name." };

  const { data: rows } = await supabase
    .from("diary_entries")
    .select(
      "food_id, grams, recipe_id, servings, quick_name, quick_kcal, quick_protein_g, quick_carbs_g, quick_fat_g, quick_fibre_g"
    )
    .eq("user_id", userId)
    .eq("entry_date", fromDate)
    .eq("meal", meal)
    .order("created_at");
  if (!rows || rows.length === 0) {
    return { error: "Nothing logged in this meal yet." };
  }

  const { data: savedMeal, error } = await supabase
    .from("saved_meals")
    .insert({ user_id: userId, name })
    .select("id")
    .single();
  if (error || !savedMeal) return { error: error?.message ?? "Could not save the meal." };

  const { error: itemsError } = await supabase
    .from("saved_meal_items")
    .insert(rows.map((row) => ({ ...row, saved_meal_id: savedMeal.id })));
  if (itemsError) {
    // Don't leave an empty shell behind.
    await supabase.from("saved_meals").delete().eq("id", savedMeal.id);
    return { error: itemsError.message };
  }

  return { error: null };
}

/** Log all of a saved meal's items into one meal on one date. */
export async function applySavedMeal(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const id = String(formData.get("saved_meal_id") ?? "");
  const meal = String(formData.get("meal") ?? "") as MealType;
  const entryDate = String(formData.get("entry_date") ?? "");

  if (!id || !MEAL_TYPES.includes(meal) || !DATE_RE.test(entryDate)) {
    return { error: "Invalid request." };
  }

  const { data: savedMeal } = await supabase
    .from("saved_meals")
    .select(
      "id, items:saved_meal_items(food_id, grams, recipe_id, servings, quick_name, quick_kcal, quick_protein_g, quick_carbs_g, quick_fat_g, quick_fibre_g)"
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!savedMeal) return { error: "Saved meal not found." };

  const items = savedMeal.items ?? [];
  if (items.length === 0) return { error: "This saved meal has no items left." };

  const { error } = await supabase
    .from("diary_entries")
    .insert(items.map((item) => ({ ...item, user_id: userId, meal, entry_date: entryDate })));
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteSavedMeal(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const id = String(formData.get("saved_meal_id") ?? "");
  if (!id) return { error: "Invalid request." };

  // RLS also enforces ownership; the filter keeps intent explicit.
  const { error } = await supabase
    .from("saved_meals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  return { error: null };
}

/** Star/unstar a food for the picker's Favorites shelf. */
export async function toggleFavoriteFood(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const foodId = String(formData.get("food_id") ?? "");
  if (!foodId) return { favorited: false };

  const { data: existing } = await supabase
    .from("favorite_foods")
    .select("food_id")
    .eq("user_id", userId)
    .eq("food_id", foodId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("favorite_foods")
      .delete()
      .eq("user_id", userId)
      .eq("food_id", foodId);
    return { favorited: false };
  }
  await supabase.from("favorite_foods").insert({ user_id: userId, food_id: foodId });
  return { favorited: true };
}

export async function logWeight(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const date = String(formData.get("date") ?? "");
  const weight = Number(formData.get("weight_kg"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date." };
  if (!(weight >= 25 && weight <= 400)) {
    return { error: "Weight must be between 25 and 400 kg." };
  }

  const { error } = await supabase.from("weight_logs").upsert(
    { user_id: userId, log_date: date, weight_kg: Math.round(weight * 10) / 10 },
    { onConflict: "user_id,log_date" }
  );
  if (error) return { error: error.message };

  // profiles.weight_kg is the "current weight" cache the target math reads;
  // keep it at the newest log (the edited date may be in the past).
  const { data: latest } = await supabase
    .from("weight_logs")
    .select("weight_kg")
    .eq("user_id", userId)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest) {
    await supabase
      .from("profiles")
      .update({ weight_kg: latest.weight_kg, updated_at: new Date().toISOString() })
      .eq("id", userId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return { error: null };
}

/**
 * Water tracking (roadmap 1.5): each tap adds/removes a glass for the day.
 * The log_water RPC increments atomically so rapid taps can't lose glasses.
 */
export async function logWater(input: { date: string; delta: number }) {
  const { supabase } = await requireUser();

  const date = String(input.date ?? "");
  const delta = Math.round(Number(input.delta));
  if (!DATE_RE.test(date) || !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 2000) {
    return { error: "Invalid request." };
  }

  const { error } = await supabase.rpc("log_water", { p_date: date, p_delta: delta });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

/** Manual workout logging (roadmap 2.4); kcal is user-estimated. */
export async function addExercise(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const date = String(formData.get("date") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const kcal = Math.round(Number(formData.get("kcal")));
  const minutesRaw = String(formData.get("minutes") ?? "").trim();
  const minutes = minutesRaw === "" ? null : Math.round(Number(minutesRaw));

  if (!DATE_RE.test(date) || !name) return { error: "Give the workout a name." };
  if (!(kcal >= 1 && kcal <= 5000)) return { error: "Calories must be between 1 and 5000." };
  if (minutes != null && !(minutes >= 1 && minutes <= 1440)) {
    return { error: "Minutes must be between 1 and 1440." };
  }

  const { error } = await supabase
    .from("exercise_logs")
    .insert({ user_id: userId, log_date: date, name, minutes, kcal });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteExercise(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("exercise_logs").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/dashboard");
}

/** Manual daily step count (roadmap 2.4) — absolute value, upserted. */
export async function logSteps(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const date = String(formData.get("date") ?? "");
  const steps = Math.round(Number(formData.get("steps")));
  if (!DATE_RE.test(date) || !(steps >= 0 && steps <= 200000)) {
    return { error: "Steps must be between 0 and 200000." };
  }

  const { error } = await supabase.from("step_logs").upsert(
    { user_id: userId, log_date: date, steps, updated_at: new Date().toISOString() },
    { onConflict: "user_id,log_date" }
  );
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteDiaryEntry(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // RLS also enforces ownership; the filter keeps intent explicit.
  await supabase.from("diary_entries").delete().eq("id", id).eq("user_id", userId);

  revalidatePath("/dashboard");
}
