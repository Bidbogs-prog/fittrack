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
    /** "prefix" matches only names/brands starting with q (for ranking). */
    match?: "contains" | "prefix";
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
  if (q) {
    const pattern = opts.match === "prefix" ? `${q}%` : `%${q}%`;
    query = query.or(`name.ilike.${pattern},brand.ilike.${pattern}`);
  }

  const { data, count } = await query;
  return { foods: (data ?? []) as Food[], total: count ?? 0 };
}

/**
 * Relevance-ranked lookup for pickers: names/brands *starting* with the
 * query outrank substring matches (searching "lait" should surface milk
 * before every biscuit "au lait"). Alphabetical within each tier.
 */
export async function rankFoods(
  supabase: SupabaseClient,
  opts: { q?: string; category?: FoodCategory | null; limit: number }
): Promise<Food[]> {
  const q = sanitizeSearch(opts.q ?? "");
  const { foods: prefix } = await searchFoods(supabase, {
    q,
    category: opts.category,
    pageSize: opts.limit,
    match: "prefix",
  });
  if (!q || prefix.length >= opts.limit) return prefix;

  const { foods: contains } = await searchFoods(supabase, {
    q,
    category: opts.category,
    pageSize: opts.limit,
    match: "contains",
  });
  const seen = new Set(prefix.map((f) => f.id));
  return [...prefix, ...contains.filter((f) => !seen.has(f.id))].slice(0, opts.limit);
}
