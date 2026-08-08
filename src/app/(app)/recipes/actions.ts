"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

function parseRecipeFields(formData: FormData): { error: string } | {
  name: string;
  description: string | null;
  servings: number;
} {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const description = String(formData.get("description") ?? "").trim().slice(0, 500) || null;
  const servings = Number(formData.get("servings"));

  if (name.length < 2) return { error: "Give the recipe a name (at least 2 characters)." };
  if (!(servings > 0 && servings <= 100)) {
    return { error: "Servings must be between 0.5 and 100." };
  }
  return { name, description, servings: Math.round(servings * 10) / 10 };
}

export async function createRecipe(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const parsed = parseRecipeFields(formData);
  if ("error" in parsed) redirect(`/recipes/new?error=${encodeURIComponent(parsed.error)}`);

  const { data, error } = await supabase
    .from("recipes")
    .insert({ ...parsed, user_id: userId })
    .select("id")
    .single();
  if (error || !data) {
    redirect(`/recipes/new?error=${encodeURIComponent(error?.message ?? "Could not create recipe.")}`);
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${data.id}`);
}

export async function updateRecipe(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/recipes");

  const parsed = parseRecipeFields(formData);
  if ("error" in parsed) redirect(`/recipes/${id}?error=${encodeURIComponent(parsed.error)}`);

  const { error } = await supabase
    .from("recipes")
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) redirect(`/recipes/${id}?error=${encodeURIComponent(error.message)}`);

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
    redirect(`/recipes/${recipeId}?error=${encodeURIComponent("Pick a food to add.")}`);
  }
  if (!(grams > 0 && grams <= 5000)) {
    redirect(`/recipes/${recipeId}?error=${encodeURIComponent("Grams must be between 1 and 5000.")}`);
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
  if (error) redirect(`/recipes/${recipeId}?error=${encodeURIComponent(error.message)}`);

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
