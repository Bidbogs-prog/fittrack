import {
  entryName,
  recipePerServing,
  savedMealTotals,
  type RecipeSuggestion,
  type SavedMealSuggestion,
} from "@/lib/diary";
import { createClient } from "@/lib/supabase/server";
import type { Food, RecipeItem, SavedMealItem } from "@/lib/types";

/**
 * Zero-query shelves for the food picker: favorites, recently logged,
 * frequently logged (last 200 entries), the user's recipes, and saved meals.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [recentRes, favRes, recipeRes, savedMealRes] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("food_id, food:foods(*)")
      .eq("user_id", userId)
      .not("food_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("favorite_foods")
      .select("food:foods(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(24),
    supabase
      .from("recipes")
      .select("*, items:recipe_items(*, food:foods(*))")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("saved_meals")
      .select("id, name, items:saved_meal_items(*, food:foods(*))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const rows = (recentRes.data ?? []) as unknown as { food_id: string; food: Food | null }[];
  const recents: Food[] = [];
  const seen = new Set<string>();
  const counts = new Map<string, { food: Food; count: number }>();
  for (const row of rows) {
    if (!row.food) continue;
    if (!seen.has(row.food_id)) {
      seen.add(row.food_id);
      recents.push(row.food);
    }
    const hit = counts.get(row.food_id);
    if (hit) hit.count += 1;
    else counts.set(row.food_id, { food: row.food, count: 1 });
  }
  const frequents = [...counts.values()]
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((c) => c.food);

  const favorites = ((favRes.data ?? []) as unknown as { food: Food | null }[])
    .map((r) => r.food)
    .filter((f): f is Food => f != null);

  const recipes: RecipeSuggestion[] = ((recipeRes.data ?? []) as unknown as {
    id: string;
    name: string;
    servings: number;
    items: RecipeItem[] | null;
  }[])
    .map((r) => {
      const items = r.items ?? [];
      return {
        id: r.id,
        name: r.name,
        servings: Number(r.servings),
        itemCount: items.length,
        perServing: recipePerServing(items, Number(r.servings)),
      };
    })
    .filter((r) => r.itemCount > 0);

  const savedMeals: SavedMealSuggestion[] = ((savedMealRes.data ?? []) as unknown as {
    id: string;
    name: string;
    items: SavedMealItem[] | null;
  }[])
    .map((m) => {
      const items = m.items ?? [];
      return {
        id: m.id,
        name: m.name,
        itemCount: items.length,
        itemNames: items.map(entryName),
        total: savedMealTotals(items),
      };
    })
    .filter((m) => m.itemCount > 0);

  return Response.json({
    favorites,
    recents: recents.slice(0, 8),
    frequents,
    favoriteIds: favorites.map((f) => f.id),
    recipes,
    savedMeals,
  });
}
