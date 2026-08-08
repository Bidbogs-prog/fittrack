"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { FOOD_CATEGORIES, type FoodCategory } from "@/lib/types";

interface UserFoodValues {
  name: string;
  brand: string | null;
  category: FoodCategory;
  barcode: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  serving_name: string | null;
  serving_grams: number | null;
}

/** Per-100 g facts for a user-created food; returns an error message or values. */
function parseUserFood(formData: FormData): { values: UserFoodValues } | { error: string } {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const brand = String(formData.get("brand") ?? "").trim().slice(0, 80) || null;
  const category = String(formData.get("category") ?? "") as FoodCategory;
  const barcodeRaw = String(formData.get("barcode") ?? "").trim();

  if (name.length < 2) return { error: "Give the food a name (at least 2 characters)." };
  if (!FOOD_CATEGORIES.includes(category)) return { error: "Pick a category." };
  if (barcodeRaw && !/^\d{6,14}$/.test(barcodeRaw)) {
    return { error: "Barcodes are 6–14 digits." };
  }

  const num = (field: string, max: number) => {
    const n = Number(formData.get(field));
    return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 10) / 10 : null;
  };
  const kcal = num("kcal", 900);
  const protein = num("protein_g", 100);
  const carbs = num("carbs_g", 100);
  const fat = num("fat_g", 100);
  const fibre = num("fibre_g", 100);
  if (kcal == null) return { error: "Calories per 100 g must be between 0 and 900." };
  if (protein == null || carbs == null || fat == null || fibre == null) {
    return { error: "Macros per 100 g must be between 0 and 100." };
  }

  // Optional household serving (roadmap 2.2): both fields or neither.
  const servingName = String(formData.get("serving_name") ?? "").trim().slice(0, 60) || null;
  const servingGramsRaw = String(formData.get("serving_grams") ?? "").trim();
  let servingGrams: number | null = null;
  if (servingGramsRaw !== "") {
    const n = Number(servingGramsRaw);
    if (!(n > 0 && n <= 5000)) return { error: "Serving weight must be between 1 and 5000 g." };
    servingGrams = Math.round(n * 10) / 10;
  }
  if ((servingName == null) !== (servingGrams == null)) {
    return { error: "A serving needs both a name and a weight — or leave both empty." };
  }

  return {
    values: {
      name,
      brand,
      category,
      barcode: barcodeRaw || null,
      kcal,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      fibre_g: fibre,
      serving_name: servingName,
      serving_grams: servingGrams,
    },
  };
}

export async function createUserFood(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const parsed = parseUserFood(formData);
  if ("error" in parsed) {
    redirect(`/foods/new?error=${encodeURIComponent(parsed.error)}`);
  }

  const { error } = await supabase
    .from("foods")
    .insert({ ...parsed.values, owner_id: userId, source: "manual" });
  if (error) redirect(`/foods/new?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/foods");
  redirect("/foods?mine=1");
}

export async function updateUserFood(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/foods");

  const parsed = parseUserFood(formData);
  if ("error" in parsed) {
    redirect(`/foods/${id}/edit?error=${encodeURIComponent(parsed.error)}`);
  }

  // RLS also enforces ownership; the filter keeps intent explicit.
  const { error } = await supabase
    .from("foods")
    .update({ ...parsed.values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) redirect(`/foods/${id}/edit?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/foods");
  revalidatePath("/dashboard");
  redirect("/foods?mine=1");
}

export async function deleteUserFood(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("foods").delete().eq("id", id).eq("owner_id", userId);

  revalidatePath("/foods");
  revalidatePath("/dashboard");
  redirect("/foods?mine=1");
}
