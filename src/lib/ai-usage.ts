import type { createClient } from "@/lib/supabase/server";
import type { LlmUsage } from "@/lib/llm";

/**
 * AI metering (roadmap 1.6 D): one `ai_usage` row per model call, used for
 * per-user caps now and for pricing from real cost data later.
 *
 *   AI_COACH_DISABLED=1               global kill switch for the coach
 *   COACH_DAILY_MESSAGE_LIMIT           free: replies per UTC day (default 10, 0 = unlimited)
 *   COACH_MONTHLY_MESSAGE_LIMIT         free: replies per UTC month (default 30, 0 = unlimited)
 *   COACH_PREMIUM_DAILY_MESSAGE_LIMIT   premium: replies per UTC day (default 50, 0 = unlimited);
 *                                       premium has no monthly cap
 *
 * Defaults are the free-tier allowance, so a deploy that forgets the env
 * vars stays cheap rather than open-ended.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AiFeature = "coach" | "coach_summary";

export async function recordAiUsage(
  supabase: Supabase,
  userId: string,
  feature: AiFeature,
  usage: LlmUsage
): Promise<void> {
  const { error } = await supabase.from("ai_usage").insert({
    user_id: userId,
    feature,
    provider: usage.provider,
    model: usage.model,
    input_tokens: usage.inputTokens,
    cached_tokens: usage.cachedTokens,
    output_tokens: usage.outputTokens,
    cost_usd: usage.costUsd,
  });
  // Metering must never fail the user's request; the log shows the gap.
  if (error) console.error(`[ai_usage] insert failed: ${error.message}`);
}

function limit(name: string, fallback: number | null): number | null {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function coachDisabled(): boolean {
  return process.env.AI_COACH_DISABLED === "1";
}

export interface CoachAllowance {
  premium: boolean;
  /** null = unlimited */
  daily: number | null;
  monthly: number | null;
  usedToday: number;
  usedMonth: number;
  /** false when usage couldn't be read (metering outage) */
  known: boolean;
}

/** The user's coach caps and how much of them is used (UTC day / month). */
export async function getCoachAllowance(
  supabase: Supabase,
  userId: string,
  premium: boolean
): Promise<CoachAllowance> {
  const daily = premium
    ? limit("COACH_PREMIUM_DAILY_MESSAGE_LIMIT", 50)
    : limit("COACH_DAILY_MESSAGE_LIMIT", 10);
  const monthly = premium ? null : limit("COACH_MONTHLY_MESSAGE_LIMIT", 30);
  const base = { premium, daily, monthly, usedToday: 0, usedMonth: 0 };
  if (daily == null && monthly == null) return { ...base, known: true };

  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const { data, error } = await supabase
    .from("ai_usage")
    .select("created_at")
    .eq("user_id", userId)
    .eq("feature", "coach")
    .gte("created_at", (monthly != null ? monthStart : dayStart).toISOString());
  if (error || !data) return { ...base, known: false };
  return {
    ...base,
    usedMonth: data.length,
    usedToday: data.filter((r) => new Date(r.created_at as string) >= dayStart).length,
    known: true,
  };
}

/** Null when within limits, otherwise a user-facing reason. */
export async function coachQuotaError(
  supabase: Supabase,
  userId: string,
  premium: boolean
): Promise<string | null> {
  const a = await getCoachAllowance(supabase, userId, premium);
  // Fail open: a metering outage shouldn't lock paying users out.
  if (!a.known) return null;
  if (a.monthly != null && a.usedMonth >= a.monthly) {
    return "You've used this month's coach messages. They reset on the 1st.";
  }
  if (a.daily != null && a.usedToday >= a.daily) {
    return "You've reached today's coach message limit. Try again tomorrow.";
  }
  return null;
}
