"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { rankFoods } from "@/lib/foods";
import { GeminiError, generateJson, type GeminiSchema } from "@/lib/gemini";
import { round1 } from "@/lib/nutrition";
import { MEAL_TYPES, type Food, type MealType } from "@/lib/types";

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
}

interface ParsedItem extends AiEstimate {
  name: string;
  portion: string;
  grams: number;
  search_query: string;
}

const PARSE_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", description: "Short display name for this food, max 60 chars" },
          portion: {
            type: "STRING",
            description: "The portion as understood, e.g. '1 large bowl' or '2 slices'",
          },
          grams: { type: "NUMBER", description: "Estimated edible weight in grams" },
          kcal: { type: "NUMBER", description: "Calories for the whole portion" },
          protein_g: { type: "NUMBER" },
          carbs_g: { type: "NUMBER" },
          fat_g: { type: "NUMBER" },
          fibre_g: { type: "NUMBER" },
          search_query: {
            type: "STRING",
            description:
              "2-3 generic words to find this food in the database, e.g. 'poulet grillé' or 'white rice'",
          },
        },
        required: [
          "name",
          "portion",
          "grams",
          "kcal",
          "protein_g",
          "carbs_g",
          "fat_g",
          "fibre_g",
          "search_query",
        ],
      },
    },
  },
  required: ["items"],
};

const PARSE_SYSTEM_PROMPT = `You are the meal-parsing engine of So3ra, a nutrition tracker used mainly in Morocco. Given a user's description of a meal (text, photo, or both), split it into distinct food items and estimate each portion like a careful registered dietitian.

Rules:
- One item per distinct food. Composite dishes the user names as one thing (e.g. "tagine de poulet") stay one item unless the user lists components.
- grams is the edible cooked weight actually eaten. When the user gives an amount, respect it; otherwise assume typical portions, erring on the conservative side.
- kcal and macros are for the WHOLE portion, not per 100 g, and must be plausible for the grams given.
- The user may write in English, French, Arabic or Darija. Keep "name" in the language the user used; for photos use the photo's most likely local name.
- search_query: generic words that would match a food database built from Open Food Facts Morocco (mostly French product names) plus common whole foods in English. Prefer the French generic term for produce and dishes, the brand name for packaged products.
- A photo shows one meal: identify only foods you can actually see, plus obvious hidden staples (cooking oil) folded into the item's estimate.
- If nothing edible is described or visible, return an empty items array.`;

const MAX_ITEMS = 10;

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
): Promise<{ items: AiMealItem[]; error: null } | { items: null; error: string }> {
  const { supabase } = await requireUser();

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

  let parsed: { items: ParsedItem[] };
  try {
    parsed = await generateJson<{ items: ParsedItem[] }>({
      systemPrompt: PARSE_SYSTEM_PROMPT,
      userPrompt: description
        ? `MEAL DESCRIPTION\n${description}`
        : "Identify the foods in this meal photo.",
      schema: PARSE_SCHEMA,
      temperature: 0.2,
      image,
    });
  } catch (err) {
    if (err instanceof GeminiError) return { items: null, error: err.message };
    throw err;
  }

  const rows = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, MAX_ITEMS);
  const items = (
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
      });
    }
  }

  const { error } = await supabase.from("diary_entries").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}
