"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { MEAL_TYPES, type MealType } from "@/lib/types";

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

export async function deleteDiaryEntry(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // RLS also enforces ownership; the filter keeps intent explicit.
  await supabase.from("diary_entries").delete().eq("id", id).eq("user_id", userId);

  revalidatePath("/dashboard");
}
