"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { statusUrl } from "@/i18n/status";
import { parseRecipeFields } from "@/lib/recipe-form";

export async function createRecipe(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const parsed = parseRecipeFields(formData);
  if ("error" in parsed) redirect(statusUrl("/recipes/new", "error", parsed.error));

  const { data, error } = await supabase
    .from("recipes")
    .insert({ ...parsed, user_id: userId })
    .select("id")
    .single();
  if (error || !data) {
    redirect(statusUrl("/recipes/new", "error", "couldNotSave"));
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${data.id}`);
}

export async function updateRecipe(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/recipes");

  const parsed = parseRecipeFields(formData);
  if ("error" in parsed) redirect(statusUrl(`/recipes/${id}`, "error", parsed.error));

  const { error } = await supabase
    .from("recipes")
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) redirect(statusUrl(`/recipes/${id}`, "error", "couldNotSave"));

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

export async function deleteRecipe(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Diary entries that logged this recipe keep their macro snapshots
  // (recipe_id just goes null) — history survives the deletion.
  await supabase.from("recipes").delete().eq("id", id).eq("user_id", userId);

  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function addRecipeItem(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const recipeId = String(formData.get("recipe_id") ?? "");
  const foodId = String(formData.get("food_id") ?? "");
  const grams = Number(formData.get("grams"));

  if (!recipeId) redirect("/recipes");
  if (!foodId) {
    redirect(statusUrl(`/recipes/${recipeId}`, "error", "pickFood"));
  }
  if (!(grams > 0 && grams <= 5000)) {
    redirect(statusUrl(`/recipes/${recipeId}`, "error", "gramsRange"));
  }

  // Confirm ownership explicitly (RLS backs this up).
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!recipe) redirect("/recipes");

  const { error } = await supabase
    .from("recipe_items")
    .insert({ recipe_id: recipeId, food_id: foodId, grams });
  if (error) redirect(statusUrl(`/recipes/${recipeId}`, "error", "couldNotSave"));

  await supabase
    .from("recipes")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", recipeId)
    .eq("user_id", userId);

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/recipes");
}

export async function deleteRecipeItem(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const recipeId = String(formData.get("recipe_id") ?? "");
  if (!id || !recipeId) return;

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!recipe) return;

  await supabase.from("recipe_items").delete().eq("id", id).eq("recipe_id", recipeId);

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/recipes");
}
