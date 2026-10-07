"use server";

import { getActiveTargets, weekStart } from "@/lib/adaptive";
import { featureQuotaError, recordAiUsage } from "@/lib/ai-usage";
import { getProfile } from "@/lib/auth";
import { buildCoachContext } from "@/lib/coach/context";
import { loadMemories, memoryPromptBlock } from "@/lib/coach/memory";
import { coachSystemPrompt } from "@/lib/coach/prompt";
import { isPremium } from "@/lib/entitlements";
import type { GeminiSchema } from "@/lib/gemini";
import { generateJson, LlmError } from "@/lib/llm";

/**
 * Monday check-in (premium): the coach reviews last week and explains this
 * week's targets. Targets already recalibrate weekly (adaptive TDEE); the
 * change shown is computed here from the stored snapshots, never by the
 * model, which only explains it. One per user per week (coach_checkins).
 */

export interface CheckinTargets {
  kcal: number;
  protein: number;
  adaptive: boolean;
}

export interface Checkin {
  weekStart: string;
  headline: string;
  review: string;
  wins: string[];
  focus: string;
  targetNote: string;
  targets: CheckinTargets;
  /** Last check-in's targets, when there was one. */
  previous: CheckinTargets | null;
}

const SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING", description: "Max 70 characters: the week in one line" },
    review: { type: "STRING", description: "2-3 sentences on last week, citing their numbers" },
    wins: { type: "ARRAY", items: { type: "STRING" }, description: "0-2 genuine wins, one short sentence each" },
    focus: { type: "STRING", description: "One concrete focus for this week, one sentence" },
    targetNote: { type: "STRING", description: "1-2 sentences explaining this week's targets and any change" },
  },
  required: ["headline", "review", "wins", "focus", "targetNote"],
};

const CHECKIN_INSTRUCTIONS = `

THIS IS A MONDAY CHECK-IN, not a chat reply. Write it as their coach checking in at the start of the week:
- review: what last week actually looked like (logging consistency, average intake vs target, protein, weight trend), citing their numbers. Partial logging = partial picture; say so.
- wins: only genuine ones; an empty list is fine.
- focus: the single most useful habit for this week, concrete and doable, anchored in their real foods or routine.
- targetNote: explain this week's targets using TARGET CHANGE below. If targets changed, say by how much and why in plain words (adaptive targets follow what their logged intake and weight trend imply). If nothing changed, say they hold steady. Never invent a different number.
Plain text in each field, no markdown, no greetings.`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** This week's saved check-in (and the previous targets), or null. Read-only. */
export async function getCheckin(): Promise<Checkin | null> {
  const { supabase, userId } = await getProfile();
  const { data } = await supabase
    .from("coach_checkins")
    .select("payload")
    .eq("user_id", userId)
    .eq("week_start", weekStart())
    .maybeSingle();
  return (data?.payload as Checkin | undefined) ?? null;
}

/** Create this week's check-in (idempotent: returns the saved one if it exists). */
export async function generateCheckin(): Promise<{ data: Checkin; error: null } | { data: null; error: string }> {
  const { supabase, userId, profile } = await getProfile();
  if (!(await isPremium(supabase, userId))) return { data: null, error: "premiumOnly" };

  const week = weekStart();
  const existing = await getCheckin();
  if (existing) return { data: existing, error: null };

  const quota = await featureQuotaError(supabase, userId, "weekly_checkin", true);
  if (quota) return { data: null, error: quota };

  const active = await getActiveTargets(supabase, userId, profile);
  if (!active) return { data: null, error: "onboarding" };

  const [{ context, safety }, memories, { data: prevRow }] = await Promise.all([
    buildCoachContext(supabase, userId, profile, active),
    loadMemories(supabase, userId),
    supabase
      .from("coach_checkins")
      .select("targets, week_start")
      .eq("user_id", userId)
      .lt("week_start", week)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (safety.blocked) return { data: null, error: "adultsOnly" };

  const targets: CheckinTargets = {
    kcal: Math.round(active.targets.kcal),
    protein: Math.round(active.targets.protein),
    adaptive: active.adaptive != null,
  };
  const previous = (prevRow?.targets as CheckinTargets | undefined) ?? null;
  const change = previous
    ? `Last check-in (${prevRow?.week_start}): ${previous.kcal} kcal, protein ${previous.protein} g. This week: ${targets.kcal} kcal (${targets.kcal - previous.kcal >= 0 ? "+" : ""}${targets.kcal - previous.kcal}), protein ${targets.protein} g.`
    : `First check-in. This week's targets: ${targets.kcal} kcal, protein ${targets.protein} g.`;
  const how = targets.adaptive
    ? `Targets are ADAPTIVE: measured burn ${active.adaptive!.tdee} kcal from ${active.adaptive!.loggedDays} logged days and a ${active.adaptive!.weightDeltaKg} kg trend change over ${active.adaptive!.spanDays} days.`
    : "Targets are FORMULA-BASED (not enough weigh-ins and logged days yet for adaptive targets); more logging and weigh-ins will let them adapt.";

  let parsed: Omit<Checkin, "weekStart" | "targets" | "previous">;
  try {
    const res = await generateJson<typeof parsed>({
      systemPrompt: coachSystemPrompt(safety.restricted) + CHECKIN_INSTRUCTIONS,
      userPrompt: `${context}${memoryPromptBlock(memories)}\n\nTARGET CHANGE\n${change}\n${how}\n\nWrite this week's check-in (week starting ${week}).`,
      schema: SCHEMA,
      temperature: 0.4,
    });
    parsed = res.data;
    await recordAiUsage(supabase, userId, "weekly_checkin", res.usage);
  } catch (err) {
    if (err instanceof LlmError) return { data: null, error: err.message };
    throw err;
  }

  const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
  const checkin: Checkin = {
    weekStart: week,
    headline: clip(parsed.headline, 90),
    review: clip(parsed.review, 600),
    wins: (Array.isArray(parsed.wins) ? parsed.wins : []).map((w) => clip(w, 200)).filter(Boolean).slice(0, 2),
    focus: clip(parsed.focus, 240),
    targetNote: clip(parsed.targetNote, 300),
    targets,
    previous,
  };
  if (!checkin.headline || !checkin.review || !DATE_RE.test(week)) {
    return { data: null, error: "The coach came back empty-handed. Try again." };
  }

  // A concurrent request may have won the insert; return whichever is saved.
  const { error } = await supabase
    .from("coach_checkins")
    .insert({ user_id: userId, week_start: week, payload: checkin, targets });
  if (error) return { data: (await getCheckin()) ?? checkin, error: null };
  return { data: checkin, error: null };
}
