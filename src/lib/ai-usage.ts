import type { createClient } from "@/lib/supabase/server";
import type { LlmUsage } from "@/lib/llm";

/**
 * AI metering (roadmap 1.6 D): one `ai_usage` row per model call, used for
 * per-user caps now and for pricing from real cost data later.
 *
 *   AI_COACH_DISABLED=1               global kill switch for the coach
 *   COACH_DAILY_MESSAGE_LIMIT           free: replies per UTC day (default 10, 0 = unlimited)
 *   COACH_MONTHLY_MESSAGE_LIMIT         free: replies per UTC month (default 10, 0 = unlimited)
 *   COACH_PREMIUM_DAILY_MESSAGE_LIMIT   premium: replies per UTC day (default 50, 0 = unlimited);
 *                                       premium has no monthly cap
 *
 *   MEAL_LOG_DAILY_LIMIT                free: AI meal parses per UTC day (default 30, 0 = unlimited)
 *   MEAL_LOG_PREMIUM_DAILY_LIMIT        premium: AI meal parses per UTC day (default 100, 0 = unlimited)
 *   DAY_INSIGHTS_DAILY_LIMIT / DAY_INSIGHTS_PREMIUM_DAILY_LIMIT    default 5 / 20
 *   WEEK_REPORT_DAILY_LIMIT / WEEK_REPORT_PREMIUM_DAILY_LIMIT      default 3 / 10
 *   PLAN_GENERATE_DAILY_LIMIT / PLAN_GENERATE_PREMIUM_DAILY_LIMIT  default 2 / 10
 *
 *   AI_DAILY_SPEND_LIMIT_USD            global: all AI off once today's recorded cost reaches this (default 5, 0 = off)
 *
 * Defaults are the free-tier allowance, so a deploy that forgets the env
 * vars stays cheap rather than open-ended.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AiFeature = "coach" | "coach_summary" | "meal_log" | "day_insights" | "week_report" | "plan_generate";

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
  const monthly = premium ? null : limit("COACH_MONTHLY_MESSAGE_LIMIT", 10);
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

/** Per-feature daily caps: [env prefix, free default, premium default]. */
const DAILY_CAPS: Partial<Record<AiFeature, [string, number, number]>> = {
  meal_log: ["MEAL_LOG", 30, 100],
  day_insights: ["DAY_INSIGHTS", 5, 20],
  week_report: ["WEEK_REPORT", 3, 10],
  plan_generate: ["PLAN_GENERATE", 2, 10],
};

const CAP_MESSAGES: Partial<Record<AiFeature, string>> = {
  meal_log: "You've reached today's AI logging limit. You can still log from the food search, or try again tomorrow.",
};

let spendCache: { at: number; over: boolean } | null = null;

/**
 * Global kill switch (GTM G1): true once today's total recorded AI cost
 * (UTC) reaches AI_DAILY_SPEND_LIMIT_USD. Cached for a minute per instance;
 * fails open. Complements the gateway key's own spend cap.
 */
export async function aiSpendExceeded(supabase: Supabase): Promise<boolean> {
  const raw = process.env.AI_DAILY_SPEND_LIMIT_USD;
  const cap = raw == null || raw === "" ? 5 : Number(raw);
  if (!(cap > 0)) return false;
  if (spendCache && Date.now() - spendCache.at < 60_000) return spendCache.over;
  const { data, error } = await supabase.rpc("ai_spend_today");
  if (error) return false;
  const over = Number(data) >= cap;
  if (over) console.warn(`[ai_usage] daily spend ${Number(data).toFixed(2)} USD reached the ${cap} USD limit`);
  spendCache = { at: Date.now(), over };
  return over;
}

/** Null when within the feature's daily cap, otherwise a user-facing reason. Fails open. */
export async function featureQuotaError(
  supabase: Supabase,
  userId: string,
  feature: AiFeature,
  premium: boolean
): Promise<string | null> {
  if (await aiSpendExceeded(supabase)) return "AI features are temporarily unavailable. Try again later.";
  const cap = DAILY_CAPS[feature];
  if (!cap) return null;
  const [prefix, free, paid] = cap;
  const daily = premium
    ? limit(`${prefix}_PREMIUM_DAILY_LIMIT`, paid)
    : limit(`${prefix}_DAILY_LIMIT`, free);
  if (daily == null) return null;
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .gte("created_at", dayStart.toISOString());
  if (error || count == null) return null;
  return count >= daily
    ? (CAP_MESSAGES[feature] ?? "You've reached today's limit for this AI feature. Try again tomorrow.")
    : null;
}

/** Null when within limits, otherwise which cap was hit (translated by the chat). */
export async function coachQuotaError(
  supabase: Supabase,
  userId: string,
  premium: boolean
): Promise<"dailyLimit" | "monthlyLimit" | null> {
  const a = await getCoachAllowance(supabase, userId, premium);
  // Fail open: a metering outage shouldn't lock paying users out.
  if (!a.known) return null;
  if (a.monthly != null && a.usedMonth >= a.monthly) {
    return "monthlyLimit";
  }
  if (a.daily != null && a.usedToday >= a.daily) {
    return "dailyLimit";
  }
  return null;
}
