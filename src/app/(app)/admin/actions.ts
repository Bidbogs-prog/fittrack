"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  FOOD_CATEGORIES,
  MEAL_TYPES,
  MICRO_KEYS,
  type FoodCategory,
  type Goal,
  type MealType,
  type MicroValues,
} from "@/lib/types";

const GOAL_VALUES: Goal[] = ["lose", "maintain", "gain"];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function numField(formData: FormData, name: string): number {
  const n = Number(formData.get(name));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/** Optional numeric field: blank means unknown (null), invalid means NaN. */
function optionalNumField(formData: FormData, name: string): number | null {
  const raw = formData.get(name);
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

async function uploadImage(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  file: File
): Promise<string | { error: string }> {
  if (!file.type.startsWith("image/")) return { error: "The image must be an image file." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "Images must be 4 MB or smaller." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("food-images")
    .upload(path, file, { contentType: file.type });
  if (error) return { error: error.message };

  return supabase.storage.from("food-images").getPublicUrl(path).data.publicUrl;
}

// ---------- FOODS ----------

export async function saveFood(formData: FormData) {
  const { supabase } = await requireAdmin();
  const back = "/admin/foods";

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "") as FoodCategory;

  const kcal = numField(formData, "kcal");
  const protein = numField(formData, "protein_g");
  const carbs = numField(formData, "carbs_g");
  const fat = numField(formData, "fat_g");
  const fibre = numField(formData, "fibre_g");

  const micros = Object.fromEntries(
    MICRO_KEYS.map((key) => [key, optionalNumField(formData, key)])
  ) as MicroValues;

  if (!name) fail(back, "Give the food a name.");
  if (!FOOD_CATEGORIES.includes(category)) fail(back, "Pick a valid category.");
  if ([kcal, protein, carbs, fat, fibre].some(Number.isNaN)) {
    fail(back, "All nutritional facts must be zero or positive numbers.");
  }
  if (Object.values(micros).some((v) => v != null && Number.isNaN(v))) {
    fail(back, "Micronutrient values must be zero or positive numbers — or left blank if unknown.");
  }

  let imageUrl: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const uploaded = await uploadImage(supabase, image);
    if (typeof uploaded !== "string") fail(back, uploaded.error);
    imageUrl = uploaded;
  }

  const row = {
    name,
    brand,
    category,
    kcal,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fibre_g: fibre,
    ...micros,
    updated_at: new Date().toISOString(),
    ...(imageUrl ? { image_url: imageUrl } : {}),
  };

  const { error } = id
    ? await supabase.from("foods").update(row).eq("id", id)
    : await supabase.from("foods").insert(row);

  if (error) fail(back, error.message);

  revalidatePath("/admin/foods");
  revalidatePath("/foods");
  revalidatePath("/dashboard");
  redirect(`${back}?saved=${encodeURIComponent(name)}`);
}

export async function deleteFood(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await supabase.from("foods").delete().eq("id", id);
  if (error) fail("/admin/foods", error.message);

  revalidatePath("/admin/foods");
  revalidatePath("/foods");
}

// ---------- MEAL PLANS ----------

export async function createPlan(formData: FormData) {
  const { supabase } = await requireAdmin();
  const back = "/admin/plans";

  const name = String(formData.get("name") ?? "").trim();
  const goal = String(formData.get("goal") ?? "") as Goal;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!name) fail(back, "Give the plan a name.");
  if (!GOAL_VALUES.includes(goal)) fail(back, "Pick a valid goal.");

  const { data, error } = await supabase
    .from("meal_plans")
    .insert({ name, goal, description })
    .select("id")
    .single();

  if (error || !data) fail(back, error?.message ?? "Could not create the plan.");

  revalidatePath("/admin/plans");
  revalidatePath("/plans");
  redirect(`/admin/plans/${data.id}`);
}

export async function deletePlan(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await supabase.from("meal_plans").delete().eq("id", id);
  if (error) fail("/admin/plans", error.message);

  revalidatePath("/admin/plans");
  revalidatePath("/plans");
  redirect("/admin/plans");
}

export async function addPlanItem(formData: FormData) {
  const { supabase } = await requireAdmin();

  const planId = String(formData.get("plan_id") ?? "");
  const back = `/admin/plans/${planId}`;
  const foodId = String(formData.get("food_id") ?? "");
  const meal = String(formData.get("meal") ?? "") as MealType;
  const grams = Number(formData.get("grams"));

  if (!planId || !foodId) fail("/admin/plans", "Missing plan or food.");
  if (!MEAL_TYPES.includes(meal)) fail(back, "Pick a valid meal.");
  if (!(grams > 0 && grams <= 5000)) fail(back, "Grams must be between 1 and 5000.");

  const { error } = await supabase
    .from("meal_plan_items")
    .insert({ plan_id: planId, food_id: foodId, meal, grams });

  if (error) fail(back, error.message);

  revalidatePath(back);
  revalidatePath("/plans");
}

export async function deletePlanItem(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const planId = String(formData.get("plan_id") ?? "");
  if (!id) return;

  await supabase.from("meal_plan_items").delete().eq("id", id);

  revalidatePath(`/admin/plans/${planId}`);
  revalidatePath("/plans");
}
