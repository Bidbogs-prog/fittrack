"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveTargets } from "@/lib/adaptive";
import { getProfile, requireUser } from "@/lib/auth";
import { GeminiError, generateJson, type GeminiSchema } from "@/lib/gemini";
import { macrosForPortion, sumMacros } from "@/lib/nutrition";
import { MEAL_TYPES, type Food, type MealPlanItem, type MealType } from "@/lib/types";

/**
 * Actionable plans (roadmap 1.4): any visible plan can be logged into the
 * diary in one tap, and users can generate a private plan with AI from
 * their targets + food preferences, composed strictly from real library
 * foods (macros stay derived, never invented).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Copy a plan's items into the diary as normal food entries. */
export async function applyPlanToDiary(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const planId = String(formData.get("plan_id") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!planId || !DATE_RE.test(date)) return { error: "Invalid request." };

  // RLS scopes visibility: global plans and the user's own.
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, items:meal_plan_items(meal, food_id, grams)")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { error: "Plan not found." };

  const items = (plan.items ?? []) as Pick<MealPlanItem, "meal" | "food_id" | "grams">[];
  if (items.length === 0) return { error: "This plan has no items." };

  const { error } = await supabase.from("diary_entries").insert(
    items.map((item) => ({
      user_id: userId,
      entry_date: date,
      meal: item.meal,
      food_id: item.food_id,
      grams: item.grams,
    }))
  );
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect(`/dashboard?d=${date}`);
}

/** Delete one of the user's own AI-generated plans. */
export async function deletePlan(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const planId = String(formData.get("plan_id") ?? "");
  if (!planId) return;

  await supabase.from("meal_plans").delete().eq("id", planId).eq("owner_id", userId);
  revalidatePath("/plans");
  redirect("/plans");
}

interface GeneratedPlan {
  name: string;
  description: string;
  items: { meal: MealType; food_id: string; grams: number }[];
}

const PLAN_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", description: "Short appetising plan name, max 50 chars" },
    description: {
      type: "STRING",
      description: "1-2 sentences on the idea behind the day, max 180 chars",
    },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          meal: { type: "STRING", enum: [...MEAL_TYPES] },
          food_id: { type: "STRING", description: "id copied exactly from the food list" },
          grams: { type: "NUMBER", description: "portion in grams" },
        },
        required: ["meal", "food_id", "grams"],
      },
    },
  },
  required: ["name", "description", "items"],
};

const PLAN_SYSTEM_PROMPT = `You are the meal-planning engine of FitTrack, composing one full day of eating for a user in Morocco, with the practicality of a registered dietitian.

You are given the user's daily targets, their stated preferences, and a food list from the app's database. Compose breakfast, lunch, dinner and optionally snacks.

Rules:
- Use ONLY foods from the list, referenced by their exact id. Never invent foods or ids.
- Portions in grams, realistic for the food (a spice or oil is 5-15 g, a main protein 100-250 g). Multiples of 5.
- The day's total calories must land within 3% of the target; get protein as close as possible, then carbs/fat.
- Meals must be culturally plausible combinations someone would actually cook and eat, not macro-filler piles. 2-4 items per meal.
- Respect the user's preferences and exclusions strictly (allergies and religious exclusions are hard constraints).
- If the preferences exclude so much that the target is unreachable with this list, still return the best valid day you can.`;

/** Generate a private AI plan from targets + free-text preferences. */
export async function generateAiPlan(formData: FormData): Promise<{ error: string }> {
  const { supabase, userId, profile } = await getProfile();

  const preferences = String(formData.get("preferences") ?? "")
    .trim()
    .slice(0, 500);

  const active = await getActiveTargets(supabase, userId, profile);
  if (!active) return { error: "Finish onboarding first so the plan knows your targets." };
  const { targets } = active;

  // Candidate foods: the curated seed library plus the user's own foods
  // and favourites. The full OFF import is too big and too branded to
  // hand to the model wholesale.
  const [{ data: seed }, { data: own }, { data: favs }] = await Promise.all([
    supabase.from("foods").select("*").is("owner_id", null).eq("source", "manual").limit(120),
    supabase.from("foods").select("*").not("owner_id", "is", null).limit(30),
    supabase.from("favorite_foods").select("food:foods(*)").eq("user_id", userId).limit(24),
  ]);
  const candidates = new Map<string, Food>();
  for (const food of [
    ...((seed ?? []) as Food[]),
    ...((own ?? []) as Food[]),
    ...(((favs ?? []) as unknown as { food: Food | null }[]).map((r) => r.food).filter(
      (f): f is Food => f != null
    ) as Food[]),
  ]) {
    candidates.set(food.id, food);
  }
  if (candidates.size < 10) {
    return { error: "The food library is too small to plan from yet." };
  }

  const foodList = [...candidates.values()]
    .map(
      (f) =>
        `${f.id} | ${f.name}${f.brand ? ` (${f.brand})` : ""} | ${f.category} | per 100 g: ${Math.round(f.kcal)} kcal, P ${f.protein_g}, C ${f.carbs_g}, F ${f.fat_g}, Fb ${f.fibre_g}`
    )
    .join("\n");

  const userPrompt = `DAILY TARGETS
- Calories ${targets.kcal} kcal · protein ${targets.protein} g · carbs ${targets.carbs} g · fat ${targets.fat} g · fibre ${targets.fibre} g

USER PREFERENCES
${preferences || "None given — assume typical Moroccan tastes."}

FOOD LIST (id | name | category | facts per 100 g)
${foodList}`;

  let generated: GeneratedPlan;
  try {
    generated = await generateJson<GeneratedPlan>({
      systemPrompt: PLAN_SYSTEM_PROMPT,
      userPrompt,
      schema: PLAN_SCHEMA,
      temperature: 0.7,
    });
  } catch (err) {
    if (err instanceof GeminiError) return { error: err.message };
    throw err;
  }

  const items = (Array.isArray(generated.items) ? generated.items : [])
    .filter(
      (item) =>
        MEAL_TYPES.includes(item.meal) &&
        candidates.has(item.food_id) &&
        Number(item.grams) >= 5 &&
        Number(item.grams) <= 2000
    )
    .slice(0, 24);
  const meals = new Set(items.map((i) => i.meal));
  if (items.length < 4 || !meals.has("breakfast") || !meals.has("lunch") || !meals.has("dinner")) {
    return { error: "The plan came back incomplete — try again, or loosen the preferences." };
  }

  // Ground truth is grams x per-100 g facts, not the model's arithmetic.
  // If the composed day misses the calorie target, scale portions.
  const total = sumMacros(items.map((i) => macrosForPortion(candidates.get(i.food_id)!, i.grams)));
  if (total.kcal <= 0) return { error: "The plan came back empty — try again." };
  const scale = Math.min(1.6, Math.max(0.6, targets.kcal / total.kcal));
  const scaled = items.map((item) => ({
    ...item,
    grams: Math.max(5, Math.round((item.grams * scale) / 5) * 5),
  }));

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .insert({
      name: String(generated.name ?? "").trim().slice(0, 50) || "AI meal plan",
      description: String(generated.description ?? "").trim().slice(0, 180) || null,
      goal: targets.goal,
      owner_id: userId,
    })
    .select("id")
    .single();
  if (planError || !plan) return { error: planError?.message ?? "Could not save the plan." };

  const { error: itemsError } = await supabase.from("meal_plan_items").insert(
    scaled.map((item) => ({
      plan_id: plan.id,
      meal: item.meal,
      food_id: item.food_id,
      grams: item.grams,
    }))
  );
  if (itemsError) {
    await supabase.from("meal_plans").delete().eq("id", plan.id).eq("owner_id", userId);
    return { error: itemsError.message };
  }

  revalidatePath("/plans");
  redirect(`/plans/${plan.id}`);
}
