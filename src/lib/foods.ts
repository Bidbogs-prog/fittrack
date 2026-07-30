import type { SupabaseClient } from "@supabase/supabase-js";
import { FOOD_CATEGORIES, type Food, type FoodCategory } from "@/lib/types";

export const FOODS_PAGE_SIZE = 24;

/** PostgREST or() filters parse commas/parens; ilike treats % and _ as wildcards. */
export function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[,()%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function parseCategory(c: string | null | undefined): FoodCategory | null {
  return FOOD_CATEGORIES.find((cat) => cat === c) ?? null;
}

export async function searchFoods(
  supabase: SupabaseClient,
  opts: {
    q?: string;
    category?: FoodCategory | null;
    page?: number;
    pageSize?: number;
    orderBy?: "name" | "newest";
  }
): Promise<{ foods: Food[]; total: number }> {
  const pageSize = opts.pageSize ?? FOODS_PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);

  const base = supabase.from("foods").select("*", { count: "exact" });
  let query = (
    opts.orderBy === "newest" ? base.order("created_at", { ascending: false }) : base.order("name")
  ).range((page - 1) * pageSize, page * pageSize - 1);
  if (opts.category) query = query.eq("category", opts.category);
  const q = sanitizeSearch(opts.q ?? "");
  if (q) query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%`);

  const { data, count } = await query;
  return { foods: (data ?? []) as Food[], total: count ?? 0 };
}
