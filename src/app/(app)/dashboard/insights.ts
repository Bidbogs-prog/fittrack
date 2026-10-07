"use server";

import { getActiveTargets, type ActiveTargets } from "@/lib/adaptive";
import { featureQuotaError, recordAiUsage } from "@/lib/ai-usage";
import { getProfile } from "@/lib/auth";
import { buildCoachContext } from "@/lib/coach/context";
import { RESTRICTED_BLOCK } from "@/lib/coach/prompt";
import { entryAmountLabel, entryMacros, entryMicros, entryName } from "@/lib/diary";
import { isPremium } from "@/lib/entitlements";
import { type GeminiSchema } from "@/lib/gemini";
import { generateJson, LlmError } from "@/lib/llm";
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
import {
  MEAL_TYPES,
  MICRO_KEYS,
  type DiaryEntry,
  type ExerciseLog,
  type MealType,
  type Profile,
} from "@/lib/types";

/**
 * The coach's read of one day (roadmap 1.3, revamped): judgement, not a
 * recap — a one-line read, up to three notes, and for premium users on
 * today a concrete next meal from their own foods that logs in one tap.
 * "Continue in coach" turns the read into the first message of a chat.
 */

export interface DayInsight {
  /** win = on track, watch = needs attention, tip = practical adjustment or fact. */
  kind: "win" | "watch" | "tip";
  /** 1–2 word topic label, e.g. "Protein", "Fibre". */
  tag: string;
  text: string;
}

/** Premium: the coach's plan for the next meal, built from the user's own foods. */
export interface NextMeal {
  meal: MealType;
  items: { name: string; grams: number }[];
  kcal: number;
  protein: number;
  why: string;
}

export interface DayInsights {
  summary: string;
  /** At most 3 notes, most important first. */
  insights: DayInsight[];
  /** Today only, premium only; absent when the day is done or nothing fits. */
  next?: NextMeal | null;
}

const NOTE_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", enum: ["win", "watch", "tip"] },
    tag: { type: "STRING", description: "1-2 word topic label" },
    text: { type: "STRING", description: "One or two short sentences" },
  },
  required: ["kind", "tag", "text"],
};

function insightsSchema(withNext: boolean): GeminiSchema {
  return {
    type: "OBJECT",
    properties: {
      summary: {
        type: "STRING",
        description: "One sentence, max 120 characters: the single most useful read of the day",
      },
      insights: { type: "ARRAY", items: NOTE_SCHEMA, description: "1 to 3 notes, most important first" },
      ...(withNext
        ? {
            next: {
              type: "OBJECT",
              description: "The next meal to eat today; omit when the day is effectively done",
              properties: {
                meal: { type: "STRING", enum: ["breakfast", "lunch", "dinner", "snack"] },
                items: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: { name: { type: "STRING" }, grams: { type: "NUMBER" } },
                    required: ["name", "grams"],
                  },
                },
                kcal: { type: "NUMBER" },
                protein: { type: "NUMBER" },
                why: { type: "STRING", description: "One sentence: what this meal fixes about the day" },
              },
              required: ["meal", "items", "kcal", "protein", "why"],
            },
          }
        : {}),
    },
    required: ["summary", "insights"],
  };
}

const SYSTEM_PROMPT = `You are the So3ra coach giving a quick read of one diary day, with the rigour of a registered dietitian. The user already sees their calories, macros and meals on screen — your job is judgement, not a recap.

Write:
- summary: the one thing that matters most about this day, in one sentence.
- insights: 1 to 3 notes, most important first. "win" = genuinely on track (never invent praise); "watch" = something worth changing; "tip" = a food-level adjustment grounded in what they actually ate. Skip anything trivial. Don't restate a number unless it makes the point.

Priorities, in order: calories vs target, protein, fibre and food quality; then sodium, saturated fat or added sugar only when clearly high (well above the daily value). Do NOT flag dietary cholesterol on its own — current guidelines (e.g. the US Dietary Guidelines since 2015) dropped the 300 mg limit, and eggs within an otherwise balanced day are fine. Don't flag single micronutrients from one day; that's a pattern question, not a daily one.

Rules:
- Ground every statement in the data. Never invent foods, amounts or nutrients. "unknown" micronutrients are missing data, not zero.
- Today is in progress: frame gaps as what's left to do, not as failures. A past day: frame notes as lessons for next time.
- Second person, metric units, plain text, no greetings, no emojis.
- No diagnosis, disease talk or supplement prescriptions.`;

const NEXT_RULES = `

NEXT MEAL — fill "next" only for today, when a meaningful amount is left: plan the meal they'd naturally eat next at this time of day, sized to what's left of today's targets (prioritise protein, stay within the remaining calories). Use foods from THEIR lists in the second data block (frequent foods, favourites, food library) with gram amounts so it logs in one tap; generic local staples are fine. 2 to 4 items. kcal and protein must add up from the items. Omit "next" if the day is done or under 200 kcal remain.`;

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
  active: ActiveTargets,
  exercises: ExerciseLog[]
): string {
  const { targets, adaptive } = active;
  const eaten = sumMacros(entries.map(entryMacros));
  const burned = exercises.reduce((sum, e) => sum + e.kcal, 0);
  const exerciseBlock =
    exercises.length === 0
      ? "EXERCISE: none logged"
      : `EXERCISE (${burned} kcal total${
          adaptive
            ? "; already part of the adaptive TDEE, no extra calorie credit"
            : `; the calorie target for this day is raised to ${targets.kcal + burned} kcal`
        })
${exercises
  .map((e) => `- ${e.name}${e.minutes != null ? `, ${e.minutes} min` : ""}: ${e.kcal} kcal`)
  .join("\n")}`;
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

${exerciseBlock}

MEALS
${meals}

MICRONUTRIENT TOTALS (adult daily values; unknown = food data missing, not zero)
${describeMicros(entries)}`;
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** Validate model output; drops a malformed next meal rather than failing the read. */
function clean(raw: DayInsights, withNext: boolean): DayInsights | null {
  const summary = clip(raw.summary, 160);
  const insights = (Array.isArray(raw.insights) ? raw.insights : [])
    .filter((n) => n && ["win", "watch", "tip"].includes(n.kind) && n.text)
    .slice(0, 3)
    .map((n) => ({ kind: n.kind, tag: clip(n.tag, 24), text: clip(n.text, 280) }));
  if (!summary || insights.length === 0) return null;
  let next: NextMeal | null = null;
  const n = raw.next;
  if (withNext && n && MEAL_TYPES.includes(n.meal) && Array.isArray(n.items)) {
    const items = n.items
      .map((i) => ({ name: clip(i?.name, 60), grams: Math.round(Number(i?.grams)) }))
      .filter((i) => i.name && i.grams >= 1 && i.grams <= 2000)
      .slice(0, 4);
    const kcal = Math.round(Number(n.kcal));
    const protein = Math.round(Number(n.protein));
    if (items.length > 0 && kcal > 0 && kcal < 3000 && protein >= 0) {
      next = { meal: n.meal, items, kcal, protein, why: clip(n.why, 200) };
    }
  }
  return { summary, insights, next };
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

  const [{ data: entriesData }, { data: exerciseData }, premium] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("*, food:foods(*)")
      .eq("user_id", userId)
      .eq("entry_date", entryDate)
      .order("created_at"),
    supabase
      .from("exercise_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", entryDate)
      .order("created_at"),
    isPremium(supabase, userId),
  ]);
  const entries = (entriesData ?? []) as DiaryEntry[];
  const exercises = (exerciseData ?? []) as ExerciseLog[];

  if (entries.length === 0) {
    return { data: null, error: "Nothing logged for this day yet — add a meal first." };
  }

  const quota = await featureQuotaError(supabase, userId, "day_insights", premium);
  if (quota) return { data: null, error: quota };

  const isToday = entryDate === new Date().toLocaleDateString("en-CA");
  const withNext = premium && isToday;
  // The coach context carries their foods (for the next meal) and the safety
  // assessment, so restricted mode applies here exactly as in the chat.
  const { context, safety } = await buildCoachContext(supabase, userId, profile, active);
  if (safety.blocked) return { data: null, error: "The coach is only available for adults (18+)." };

  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  try {
    const { data: raw, usage } = await generateJson<DayInsights>({
      systemPrompt:
        SYSTEM_PROMPT + (withNext ? NEXT_RULES : "") + (safety.restricted ? `\n\n${RESTRICTED_BLOCK}` : ""),
      userPrompt: `${describeDay(profile, entries, entryDate, active, exercises)}${
        withNext ? `\n\nTIME NOW: ${clock} (server time)\n\nTHEIR FOODS AND RECENT CONTEXT\n${context}` : ""
      }`,
      schema: insightsSchema(withNext),
      temperature: 0.3,
    });
    await recordAiUsage(supabase, userId, "day_insights", usage);
    const data = clean(raw, withNext);
    if (!data) return { data: null, error: "The coach came back empty-handed. Try again." };
    // Persist so the read survives navigation (roadmap 1.3); best-effort,
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
    if (err instanceof LlmError) return { data: null, error: err.message };
    throw err;
  }
}

/**
 * Turn a saved day read into the opening message of a new coach chat, so
 * the user can ask follow-ups with the coach's full context. Counts nothing
 * against the coach allowance until they actually reply.
 */
export async function continueInCoach(entryDate: string): Promise<{ id: string | null }> {
  const { supabase, userId } = await getProfile();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return { id: null };
  const { data: saved } = await supabase
    .from("ai_insights")
    .select("payload")
    .eq("user_id", userId)
    .eq("scope", "day")
    .eq("period_start", entryDate)
    .maybeSingle();
  const read = saved?.payload as DayInsights | undefined;
  if (!read?.summary) return { id: null };

  const lines = [
    `**${read.summary}**`,
    ...read.insights.map((n) => `- ${n.tag}: ${n.text}`),
    ...(read.next
      ? [
          "",
          `Next (${read.next.meal}): ${read.next.items.map((i) => `${i.name} ${i.grams} g`).join(", ")} — about ${read.next.kcal} kcal, ${read.next.protein} g protein. ${read.next.why}`,
        ]
      : []),
    "",
    "Ask me anything about this day.",
  ];

  const { data: convo, error } = await supabase
    .from("coach_conversations")
    .insert({ user_id: userId, title: read.summary.slice(0, 60) })
    .select("id")
    .single();
  if (error || !convo) return { id: null };
  await supabase.from("coach_messages").insert({
    conversation_id: convo.id,
    role: "assistant",
    content: lines.join("\n").slice(0, 8000),
    payload: { source: "day_read", date: entryDate },
  });
  return { id: convo.id as string };
}
