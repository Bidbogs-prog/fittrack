"use server";

import { GeminiError, generateJson, type GeminiSchema } from "@/lib/gemini";
import { getActiveTargets, type ActiveTargets } from "@/lib/adaptive";
import { getProfile } from "@/lib/auth";
import { entryAmountLabel, entryMacros, entryMicros, entryName } from "@/lib/diary";
import {
  ACTIVITY_LEVELS,
  GOALS,
  MICRONUTRIENTS,
  ageFromBirthDate,
  formatAmount,
  percentDv,
  round1,
  sumMacros,
  sumMicros,
} from "@/lib/nutrition";
import { MEAL_TYPES, MICRO_KEYS, type DiaryEntry, type Profile } from "@/lib/types";

export interface DayInsight {
  /** win = on track, watch = needs attention, tip = practical adjustment or fact. */
  kind: "win" | "watch" | "tip";
  /** 1–2 word topic label, e.g. "Protein", "Sodium". */
  tag: string;
  text: string;
}

export interface DayInsights {
  summary: string;
  insights: DayInsight[];
}

const INSIGHTS_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING",
      description: "One-sentence overall read of the day, max 140 characters.",
    },
    insights: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          kind: { type: "STRING", enum: ["win", "watch", "tip"] },
          tag: { type: "STRING", description: "1-2 word topic label" },
          text: { type: "STRING", description: "Max 2 short sentences" },
        },
        required: ["kind", "tag", "text"],
      },
    },
  },
  required: ["summary", "insights"],
};

const SYSTEM_PROMPT = `You are the in-app nutrition coach for FitTrack, writing with the rigour of a registered dietitian. You are given one user's profile, their calculated daily targets, and everything they logged for a single day.

Produce a one-sentence summary of the day plus 3 to 5 insights. Each insight is one of:
- "win": something genuinely on track relative to their targets — never invent praise.
- "watch": a concrete risk — an exceeded upper limit (saturated fat, sodium, sugar, cholesterol), a macro far off target, or a pattern worth flagging.
- "tip": a practical, food-level adjustment for this user, or a relevant evidence-based nutrition fact tied to what they actually ate. Include at least one tip.

Rules:
- Ground every statement in the data provided. Cite the numbers (e.g. "82 g of your 130 g protein target"). Never invent foods, amounts, or nutrients.
- Micronutrients marked "unknown" have no data — say data is missing if relevant; never treat unknown as zero.
- If the day is marked as still in progress, frame gaps as guidance for the remaining meals, not as failures.
- Speak directly to the user in second person. Metric units. No greetings, no emojis, no filler.
- Educate, don't diagnose: no medical claims, disease talk, or supplement prescriptions. Extreme intakes deserve a gentle suggestion to consult a professional.`;

function describeMicros(entries: DiaryEntry[]): string {
  const totals = sumMicros(entries.map(entryMicros));
  return MICRO_KEYS.map((key) => {
    const def = MICRONUTRIENTS[key];
    const value = totals[key];
    if (value == null) return `- ${def.label}: unknown (no data)`;
    const dv = percentDv(key, value);
    const dvNote =
      dv == null ? "" : ` (${dv}% of daily value${def.limit ? "; this DV is an upper limit" : ""})`;
    return `- ${def.label}: ${formatAmount(value)} ${def.unit}${dvNote}`;
  }).join("\n");
}

function describeDay(
  profile: Profile,
  entries: DiaryEntry[],
  entryDate: string,
  active: ActiveTargets
): string {
  const { targets, adaptive } = active;
  const eaten = sumMacros(entries.map(entryMacros));
  const isToday = entryDate === new Date().toLocaleDateString("en-CA");

  const meals = MEAL_TYPES.map((meal) => {
    const rows = entries.filter((e) => e.meal === meal);
    if (rows.length === 0) return `${meal.toUpperCase()}: nothing logged`;
    const lines = rows.map((e) => {
      const m = entryMacros(e);
      const name = e.food?.brand ? `${e.food.name} (${e.food.brand})` : entryName(e);
      const note = e.food
        ? ""
        : e.recipe_id != null || e.servings != null
          ? " [saved recipe, macros snapshotted at logging; micronutrients unknown]"
          : " [quick add without a food; micronutrients unknown]";
      return `- ${name}, ${entryAmountLabel(e)}: ${Math.round(m.kcal)} kcal, protein ${round1(m.protein)} g, carbs ${round1(m.carbs)} g, fat ${round1(m.fat)} g, fibre ${round1(m.fibre)} g${note}`;
    });
    return `${meal.toUpperCase()}:\n${lines.join("\n")}`;
  }).join("\n\n");

  return `USER PROFILE
- Age ${ageFromBirthDate(profile.birth_date!)}, ${profile.gender}, ${profile.weight_kg} kg, ${profile.height_cm} cm
- Activity: ${ACTIVITY_LEVELS[profile.activity_level!].label}
- Goal: ${GOALS[targets.goal].label}

DAILY TARGETS (${
    adaptive
      ? `adaptive: TDEE ${targets.tdee} kcal measured from ${adaptive.loggedDays} logged days of intake vs the weight trend over ${adaptive.spanDays} days; BMR ${targets.bmr} kcal`
      : `calculated: Mifflin-St Jeor BMR ${targets.bmr} kcal, TDEE ${targets.tdee} kcal`
  })
- Calories ${targets.kcal} kcal · protein ${targets.protein} g · carbs ${targets.carbs} g · fat ${targets.fat} g · fibre ${targets.fibre} g

DAY BEING ANALYSED: ${entryDate}${isToday ? " (today — the day is still in progress)" : " (a completed past day)"}

TOTAL EATEN: ${Math.round(eaten.kcal)} kcal · protein ${round1(eaten.protein)} g · carbs ${round1(eaten.carbs)} g · fat ${round1(eaten.fat)} g · fibre ${round1(eaten.fibre)} g

MEALS
${meals}

MICRONUTRIENT TOTALS (adult daily values; unknown = food data missing, not zero)
${describeMicros(entries)}`;
}

export async function generateDayInsights(
  entryDate: string
): Promise<{ data: DayInsights; error: null } | { data: null; error: string }> {
  const { supabase, userId, profile } = await getProfile();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return { data: null, error: "Invalid date." };
  }
  const active = await getActiveTargets(supabase, userId, profile);
  if (!active) {
    return { data: null, error: "Finish onboarding so the coach knows your targets." };
  }

  const { data: entriesData } = await supabase
    .from("diary_entries")
    .select("*, food:foods(*)")
    .eq("user_id", userId)
    .eq("entry_date", entryDate)
    .order("created_at");
  const entries = (entriesData ?? []) as DiaryEntry[];

  if (entries.length === 0) {
    return { data: null, error: "Nothing logged for this day yet — add a meal first." };
  }

  try {
    const data = await generateJson<DayInsights>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: describeDay(profile, entries, entryDate, active),
      schema: INSIGHTS_SCHEMA,
    });
    if (!data.summary || !Array.isArray(data.insights) || data.insights.length === 0) {
      return { data: null, error: "The coach came back empty-handed. Try again." };
    }
    // Persist so the analysis survives navigation (roadmap 1.3); best-effort,
    // the generated result is still returned if the write fails.
    await supabase.from("ai_insights").upsert(
      {
        user_id: userId,
        scope: "day",
        period_start: entryDate,
        payload: data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,scope,period_start" }
    );
    return { data, error: null };
  } catch (err) {
    if (err instanceof GeminiError) return { data: null, error: err.message };
    throw err;
  }
}
