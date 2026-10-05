"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { entryMacros, recipePerServing } from "@/lib/diary";
import { rankFoods } from "@/lib/foods";
import { featureQuotaError, recordAiUsage } from "@/lib/ai-usage";
import { isPremium } from "@/lib/entitlements";
import { PARSE_SCHEMA, PARSE_SYSTEM_PROMPT } from "./ai-log-prompt";
import { generateJson, LlmError } from "@/lib/llm";
import { macrosForPortion, round1, type Macros } from "@/lib/nutrition";
import { MEAL_TYPES, type Food, type MealType, type RecipeItem } from "@/lib/types";

/**
 * AI meal logging (roadmap 1.1): a free-text description and/or photo goes
 * to Gemini, which splits it into food items with portion + macro
 * estimates. Each item is then matched against the food library so the
 * user can log a real food (macros derived per convention) or fall back
 * to the AI estimate as a quick-add snapshot. Nothing is saved without
 * the user confirming the parsed items first.
 */

/** Whole-portion macro estimate for one parsed item (not per 100 g). */
export interface AiEstimate {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
}

export interface AiMealItem {
  /** Short display name, e.g. "Grilled chicken breast". */
  name: string;
  /** The portion as understood, e.g. "1 bowl (about 250 g)". */
  portion: string;
  /** Estimated edible weight in grams. */
  grams: number;
  est: AiEstimate;
  /** Library candidates (best first); may be empty. */
  matches: Food[];
  /**
   * Set when the row came from one of the user's recipes (directly or via a
   * saved/recent meal): logging the estimate keeps the recipe link, with
   * servings scaled by grams / this item's grams.
   */
  recipe?: { id: string; servings: number };
}

interface ParsedItem extends AiEstimate {
  name: string;
  portion: string;
  grams: number;
  search_query: string;
}

/** A pointer into the user's own catalogue (saved meal, recipe, recent meal). */
interface ParsedRef {
  ref: string;
  servings: number;
}

const MAX_ITEMS = 20;
const CATALOGUE_DAYS = 7;

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** A diary-shaped row: food portion or macro snapshot (optionally a logged recipe). */
interface PayloadRow {
  food: Food | null;
  grams: number | null;
  recipe_id: string | null;
  servings: number | null;
  quick_name: string | null;
  quick_kcal: number | null;
  quick_protein_g: number | null;
  quick_carbs_g: number | null;
  quick_fat_g: number | null;
  quick_fibre_g: number | null;
}

const PAYLOAD_COLS =
  "grams, recipe_id, servings, quick_name, quick_kcal, quick_protein_g, quick_carbs_g, quick_fat_g, quick_fibre_g, food:foods(*)";

const toEst = (m: Macros, f = 1): AiEstimate => ({
  kcal: round1(m.kcal * f),
  protein_g: round1(m.protein * f),
  carbs_g: round1(m.carbs * f),
  fat_g: round1(m.fat * f),
  fibre_g: round1(m.fibre * f),
});

/** A saved/recent row as a confirmable item, scaled by `mult`. */
function payloadItem(row: PayloadRow, mult: number): AiMealItem {
  if (row.food != null && row.grams != null) {
    const grams = Math.max(1, Math.round(row.grams * mult));
    return {
      name: row.food.name,
      portion: `${grams} g`,
      grams,
      est: toEst(macrosForPortion(row.food, grams)),
      matches: [row.food],
    };
  }
  // Snapshots have no weight: a nominal 100 g "portion" lets the sheet scale it.
  const servings = row.servings != null ? Number(row.servings) * mult : null;
  return {
    name: (row.quick_name ?? "Quick add").slice(0, 60),
    portion: servings != null ? `${round1(servings)} serving${servings === 1 ? "" : "s"}` : "1 portion",
    grams: 100,
    est: toEst(entryMacros(row), mult),
    matches: [],
    ...(row.recipe_id && servings != null ? { recipe: { id: row.recipe_id, servings } } : {}),
  };
}

interface Catalogue {
  text: string;
  expand: Map<string, (mult: number) => AiMealItem[]>;
}

/**
 * The user's saved meals, recipes and last week's meals as a compact,
 * id-keyed list for the parser. Short ids (S1, R1, D1) instead of uuids:
 * the model can't invent a plausible one, and they cost fewer tokens.
 */
async function loadCatalogue(supabase: Supabase, userId: string): Promise<Catalogue> {
  const since = new Date(Date.now() - CATALOGUE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const [{ data: saved }, { data: recipes }, { data: recent }] = await Promise.all([
    supabase
      .from("saved_meals")
      .select(`id, name, items:saved_meal_items(${PAYLOAD_COLS})`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("recipes")
      .select("id, name, servings, items:recipe_items(grams, food:foods(*))")
      .eq("user_id", userId)
      .limit(30),
    supabase
      .from("diary_entries")
      .select(`entry_date, meal, ${PAYLOAD_COLS}`)
      .eq("user_id", userId)
      .gte("entry_date", since)
      .order("entry_date", { ascending: false })
      .limit(300),
  ]);

  const lines: string[] = [];
  const expand = new Map<string, (mult: number) => AiMealItem[]>();
  const kcalOf = (rows: PayloadRow[]) => Math.round(rows.reduce((s, r) => s + entryMacros(r).kcal, 0));
  const describe = (rows: PayloadRow[]) =>
    rows
      .slice(0, 6)
      .map((r) => (r.food ? `${r.food.name} ${Math.round(r.grams ?? 0)} g` : (r.quick_name ?? "quick add")))
      .join(", ");

  ((saved ?? []) as unknown as { name: string; items: PayloadRow[] }[]).forEach((m, i) => {
    if (!m.items?.length) return;
    const id = `S${i + 1}`;
    lines.push(`${id}: "${m.name}" — ${describe(m.items)} (≈${kcalOf(m.items)} kcal)`);
    expand.set(id, (mult) => m.items.map((r) => payloadItem(r, mult)));
  });

  ((recipes ?? []) as unknown as { id: string; name: string; servings: number; items: RecipeItem[] }[]).forEach(
    (r, i) => {
      if (!r.items?.length) return;
      const id = `R${i + 1}`;
      const per = recipePerServing(r.items, r.servings);
      const gramsPer = r.items.reduce((s, it) => s + it.grams, 0) / (r.servings > 0 ? r.servings : 1);
      lines.push(`${id}: recipe "${r.name}" — ${Math.round(per.kcal)} kcal per serving`);
      expand.set(id, (servings) => {
        const grams = Math.max(1, Math.round(gramsPer * servings));
        return [
          {
            name: r.name.slice(0, 60),
            portion: `${round1(servings)} serving${servings === 1 ? "" : "s"}`,
            grams,
            est: toEst(per, servings),
            matches: [],
            recipe: { id: r.id, servings },
          },
        ];
      });
    }
  );

  const groups = new Map<string, PayloadRow[]>();
  for (const row of (recent ?? []) as unknown as (PayloadRow & { entry_date: string; meal: string })[]) {
    const key = `${row.entry_date} ${row.meal}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  [...groups.entries()].slice(0, 28).forEach(([key, rows], i) => {
    const id = `D${i + 1}`;
    lines.push(`${id}: ${key} — ${describe(rows)} (≈${kcalOf(rows)} kcal)`);
    expand.set(id, (mult) => rows.map((r) => payloadItem(r, mult)));
  });

  const today = new Date().toISOString().slice(0, 10);
  return {
    text: lines.length ? `\n\nTHE USER'S OWN MEALS (today is ${today})\n${lines.join("\n")}` : "",
    expand,
  };
}

function cleanNumber(n: unknown, max: number): number | null {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 && v <= max ? round1(v) : null;
}

/**
 * Parse a meal description (field "description") and/or photo (field
 * "photo", jpeg/png/webp ≤ 3 MB) into confirmable items with library
 * matches. Read-only: nothing is written until logAiMeal.
 */
export async function parseMeal(
  formData: FormData
): Promise<
  | { items: AiMealItem[]; error: null; toCoach?: false }
  | { items: null; error: string; toCoach?: boolean }
> {
  const { supabase, userId } = await requireUser();

  const description = String(formData.get("description") ?? "")
    .trim()
    .slice(0, 1000);
  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;

  if (!description && !hasPhoto) {
    return { items: null, error: "Describe the meal or add a photo first." };
  }

  let image: { mimeType: string; base64: string } | undefined;
  if (hasPhoto) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
      return { items: null, error: "Photos must be JPEG, PNG or WebP." };
    }
    if (photo.size > 3 * 1024 * 1024) {
      return { items: null, error: "Photo is too large — try again, it should compress smaller." };
    }
    image = {
      mimeType: photo.type,
      base64: Buffer.from(await photo.arrayBuffer()).toString("base64"),
    };
  }

  const quota = await featureQuotaError(supabase, userId, "meal_log", await isPremium(supabase, userId));
  if (quota) return { items: null, error: quota };

  // Text can point at the user's own meals; a photo alone can't.
  const catalogue = description ? await loadCatalogue(supabase, userId) : { text: "", expand: new Map() };

  let parsed: { intent?: string; items: ParsedItem[]; refs?: ParsedRef[] };
  try {
    const res = await generateJson<{ intent?: string; items: ParsedItem[]; refs?: ParsedRef[] }>({
      systemPrompt: PARSE_SYSTEM_PROMPT,
      userPrompt: description
        ? `MEAL DESCRIPTION\n${description}${catalogue.text}`
        : "Identify the foods in this meal photo.",
      schema: PARSE_SCHEMA,
      temperature: 0.2,
      image,
    });
    parsed = res.data;
    await recordAiUsage(supabase, userId, "meal_log", res.usage);
  } catch (err) {
    if (err instanceof LlmError) return { items: null, error: err.message };
    throw err;
  }

  // Not a meal: the orbit hands the text to the coach instead of erroring.
  const noFood =
    (!Array.isArray(parsed.items) || parsed.items.length === 0) &&
    (!Array.isArray(parsed.refs) || parsed.refs.length === 0);
  if (!hasPhoto && (parsed.intent === "chat" || noFood)) {
    return { items: null, error: "That sounds like a question for the coach — ask it on the Coach tab.", toCoach: true };
  }

  const fromCatalogue = (Array.isArray(parsed.refs) ? parsed.refs : []).flatMap((r) => {
    const make = catalogue.expand.get(String(r.ref ?? "").trim().toUpperCase());
    const mult = cleanNumber(r.servings, 20);
    return make ? make(mult && mult > 0 ? mult : 1) : [];
  });

  const rows = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, MAX_ITEMS);
  const estimated = (
    await Promise.all(
      rows.map(async (row): Promise<AiMealItem | null> => {
        const grams = cleanNumber(row.grams, 5000);
        const kcal = cleanNumber(row.kcal, 10000);
        const name = String(row.name ?? "").trim().slice(0, 60);
        if (!name || !grams || grams < 1 || kcal == null) return null;

        let matches = await rankFoods(supabase, { q: String(row.search_query ?? ""), limit: 3 });
        if (matches.length === 0 && name !== row.search_query) {
          matches = await rankFoods(supabase, { q: name, limit: 3 });
        }
        return {
          name,
          portion: String(row.portion ?? "").trim().slice(0, 60),
          grams: Math.round(grams),
          est: {
            kcal,
            protein_g: cleanNumber(row.protein_g, 2000) ?? 0,
            carbs_g: cleanNumber(row.carbs_g, 2000) ?? 0,
            fat_g: cleanNumber(row.fat_g, 2000) ?? 0,
            fibre_g: cleanNumber(row.fibre_g, 2000) ?? 0,
          },
          matches,
        };
      })
    )
  ).filter((item): item is AiMealItem => item != null);
  const items = [...fromCatalogue, ...estimated].slice(0, MAX_ITEMS);

  if (items.length === 0) {
    return {
      items: null,
      error: hasPhoto
        ? "No food recognised in that photo — try a clearer shot or describe the meal instead."
        : "Couldn't read any foods out of that — try naming them with rough amounts.",
    };
  }
  return { items, error: null };
}

/** One reviewed item: either a library food portion or an AI-estimate snapshot. */
export interface ConfirmedAiItem {
  /** Set for library matches — logged as a normal food entry. */
  food_id: string | null;
  /** Grams for food entries (snapshot macros already account for portion). */
  grams: number | null;
  /** Snapshot fields, used when food_id is null. */
  name: string;
  est: AiEstimate | null;
  /** With est: keep the link to the user's recipe this snapshot came from. */
  recipe_id?: string | null;
  servings?: number | null;
}

/** Insert the user-confirmed items as diary entries. */
export async function logAiMeal(input: {
  meal: MealType;
  entryDate: string;
  items: ConfirmedAiItem[];
}): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireUser();

  const { meal, entryDate } = input;
  const items = Array.isArray(input.items) ? input.items.slice(0, MAX_ITEMS) : [];
  if (!MEAL_TYPES.includes(meal) || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || items.length === 0) {
    return { error: "Invalid entry." };
  }

  // Re-verify food ids server-side: RLS scopes visibility, so a food id the
  // user can't see (someone else's private food) simply won't come back.
  const foodIds = [...new Set(items.map((i) => i.food_id).filter((id): id is string => !!id))];
  let visible = new Set<string>();
  if (foodIds.length > 0) {
    const { data } = await supabase.from("foods").select("id").in("id", foodIds);
    visible = new Set((data ?? []).map((f) => f.id));
  }
  const recipeIds = [...new Set(items.map((i) => i.recipe_id).filter((id): id is string => !!id))];
  let ownRecipes = new Set<string>();
  if (recipeIds.length > 0) {
    const { data } = await supabase.from("recipes").select("id").eq("user_id", userId).in("id", recipeIds);
    ownRecipes = new Set((data ?? []).map((r) => r.id));
  }

  const rows: Record<string, unknown>[] = [];
  for (const item of items) {
    if (item.food_id) {
      const grams = Number(item.grams);
      if (!visible.has(item.food_id)) return { error: "One of the foods no longer exists." };
      if (!(grams > 0 && grams <= 5000)) return { error: "Grams must be between 1 and 5000." };
      rows.push({ user_id: userId, meal, entry_date: entryDate, food_id: item.food_id, grams });
    } else {
      const name = String(item.name ?? "").trim().slice(0, 80);
      const kcal = cleanNumber(item.est?.kcal, 10000);
      if (!name || kcal == null) return { error: "Invalid entry." };
      rows.push({
        user_id: userId,
        meal,
        entry_date: entryDate,
        quick_name: name,
        quick_kcal: kcal,
        quick_protein_g: cleanNumber(item.est?.protein_g, 2000),
        quick_carbs_g: cleanNumber(item.est?.carbs_g, 2000),
        quick_fat_g: cleanNumber(item.est?.fat_g, 2000),
        quick_fibre_g: cleanNumber(item.est?.fibre_g, 2000),
        ...(item.recipe_id && ownRecipes.has(item.recipe_id) && cleanNumber(item.servings, 100)
          ? { recipe_id: item.recipe_id, servings: cleanNumber(item.servings, 100) }
          : {}),
      });
    }
  }

  const { error } = await supabase.from("diary_entries").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}
