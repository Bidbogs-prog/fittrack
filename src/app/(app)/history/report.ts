"use server";

import { getActiveTargets } from "@/lib/adaptive";
import { getProfile } from "@/lib/auth";
import { entryMacros } from "@/lib/diary";
import { GeminiError, generateJson, type GeminiSchema } from "@/lib/gemini";
import { GOALS, round1, sumMacros } from "@/lib/nutrition";
import type { DiaryEntry, WeightLog } from "@/lib/types";
import { trendDelta, weightTrend } from "@/lib/weight";

/**
 * Weekly AI report (roadmap 1.3): a Monday-to-Sunday review of intake,
 * consistency and weight trend, generated on demand from /history and
 * persisted in ai_insights (scope "week", keyed on the Monday).
 */

export interface WeekHighlight {
  kind: "win" | "watch" | "tip";
  tag: string;
  text: string;
}

export interface WeekReport {
  summary: string;
  highlights: WeekHighlight[];
  /** The single most useful focus for next week. */
  focus: string;
}

const REPORT_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING",
      description: "1-2 sentence overall read of the week, max 220 characters.",
    },
    highlights: {
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
    focus: {
      type: "STRING",
      description: "One sentence: the single most useful focus for next week.",
    },
  },
  required: ["summary", "highlights", "focus"],
};

const SYSTEM_PROMPT = `You are the in-app nutrition coach for FitTrack, writing with the rigour of a registered dietitian. You are given one user's profile, daily targets, and a full Monday-to-Sunday week of logged nutrition and weight data, with the previous week for comparison.

Produce a weekly review: a 1-2 sentence summary, 3 to 6 highlights, and one focus for next week. Each highlight is one of:
- "win": a weekly pattern genuinely on track — consistency, averages near target, favourable weight trend. Never invent praise.
- "watch": a concrete weekly-level risk — a macro chronically off target, big weekday/weekend swings, a weight trend moving against the goal, or too few logged days to trust the numbers.
- "tip": a practical adjustment for next week grounded in what they actually logged. Include at least one.

Rules:
- Think in weekly patterns and trends, not single meals. Compare against the previous week where data allows.
- Ground every statement in the data given and cite the numbers (e.g. "protein averaged 92 g of your 130 g target"). Never invent foods, days, or numbers.
- Unlogged days are missing data, never zeros. If half the week is unlogged, say the picture is partial.
- Weight changes under ~0.3 kg in a week are noise — don't celebrate or alarm over them.
- Speak directly to the user in second person. Metric units. No greetings, no emojis, no filler.
- Educate, don't diagnose: no medical claims or supplement prescriptions.`;

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateString(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

function isMonday(date: string): boolean {
  return new Date(date + "T12:00:00").getDay() === 1;
}

function describeDays(entriesByDate: Map<string, DiaryEntry[]>, start: string): string {
  return DAY_NAMES.map((name, i) => {
    const date = shiftDate(start, i);
    const dayEntries = entriesByDate.get(date);
    if (!dayEntries || dayEntries.length === 0) return `- ${name} ${date}: not logged`;
    const m = sumMacros(dayEntries.map(entryMacros));
    return `- ${name} ${date}: ${Math.round(m.kcal)} kcal · protein ${round1(m.protein)} g · carbs ${round1(m.carbs)} g · fat ${round1(m.fat)} g · fibre ${round1(m.fibre)} g (${dayEntries.length} entries)`;
  }).join("\n");
}

function weekAverages(entriesByDate: Map<string, DiaryEntry[]>, start: string) {
  const loggedDays = [];
  for (let i = 0; i < 7; i++) {
    const dayEntries = entriesByDate.get(shiftDate(start, i));
    if (dayEntries && dayEntries.length > 0) loggedDays.push(sumMacros(dayEntries.map(entryMacros)));
  }
  if (loggedDays.length === 0) return null;
  const total = sumMacros(loggedDays);
  const n = loggedDays.length;
  return {
    days: n,
    kcal: Math.round(total.kcal / n),
    protein: round1(total.protein / n),
    carbs: round1(total.carbs / n),
    fat: round1(total.fat / n),
    fibre: round1(total.fibre / n),
  };
}

export async function generateWeekReport(
  weekStart: string
): Promise<{ data: WeekReport; error: null } | { data: null; error: string }> {
  const { supabase, userId, profile } = await getProfile();

  const today = toDateString(new Date());
  const weekEnd = shiftDate(weekStart, 6);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !isMonday(weekStart) || weekEnd >= today) {
    return { data: null, error: "Reports cover completed weeks (Monday to Sunday)." };
  }

  const active = await getActiveTargets(supabase, userId, profile);
  if (!active) {
    return { data: null, error: "Finish onboarding so the coach knows your targets." };
  }
  const { targets, adaptive } = active;

  const prevStart = shiftDate(weekStart, -7);
  const [{ data: entriesData }, { data: weightData }] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("*, food:foods(*)")
      .eq("user_id", userId)
      .gte("entry_date", prevStart)
      .lte("entry_date", weekEnd)
      .order("created_at"),
    supabase
      .from("weight_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("log_date", shiftDate(weekStart, -60))
      .lte("log_date", weekEnd)
      .order("log_date"),
  ]);

  const entriesByDate = new Map<string, DiaryEntry[]>();
  for (const entry of (entriesData ?? []) as DiaryEntry[]) {
    const list = entriesByDate.get(entry.entry_date) ?? [];
    list.push(entry);
    entriesByDate.set(entry.entry_date, list);
  }

  const week = weekAverages(entriesByDate, weekStart);
  if (!week || week.days < 3) {
    return {
      data: null,
      error: "Fewer than 3 days of that week were logged — not enough for an honest review.",
    };
  }
  const prev = weekAverages(entriesByDate, prevStart);

  const trendPoints = weightTrend((weightData ?? []) as WeightLog[]);
  const weekDelta = trendDelta(trendPoints, 7);

  const userPrompt = `USER PROFILE
- ${profile.gender}, ${profile.weight_kg} kg, goal: ${GOALS[targets.goal].label}

DAILY TARGETS${adaptive ? ` (adaptive TDEE ${targets.tdee} kcal, measured from intake vs weight trend)` : ""}
- Calories ${targets.kcal} kcal · protein ${targets.protein} g · carbs ${targets.carbs} g · fat ${targets.fat} g · fibre ${targets.fibre} g

WEEK BEING REVIEWED: ${weekStart} to ${weekEnd}
${describeDays(entriesByDate, weekStart)}

WEEK AVERAGES (over ${week.days} logged days)
- ${week.kcal} kcal · protein ${week.protein} g · carbs ${week.carbs} g · fat ${week.fat} g · fibre ${week.fibre} g

PREVIOUS WEEK (${prevStart} onwards): ${
    prev
      ? `${prev.kcal} kcal avg over ${prev.days} logged days · protein ${prev.protein} g`
      : "nothing logged"
  }

WEIGHT TREND: ${
    weekDelta != null
      ? `${weekDelta >= 0 ? "+" : ""}${weekDelta.toFixed(2)} kg over the week (smoothed trend)`
      : "not enough weigh-ins this week"
  }`;

  try {
    const data = await generateJson<WeekReport>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      schema: REPORT_SCHEMA,
    });
    if (!data.summary || !Array.isArray(data.highlights) || data.highlights.length === 0) {
      return { data: null, error: "The coach came back empty-handed. Try again." };
    }
    await supabase.from("ai_insights").upsert(
      {
        user_id: userId,
        scope: "week",
        period_start: weekStart,
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
