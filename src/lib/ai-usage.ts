import type { createClient } from "@/lib/supabase/server";
import type { LlmUsage } from "@/lib/llm";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBetaAccess } from "@/lib/beta";

/**
 * AI metering (roadmap 1.6 D): one `ai_usage` row per model call, used for
 * per-user caps now and for pricing from real cost data later.
 *
 *   AI_COACH_DISABLED=1               global kill switch for the coach
 *   COACH_DAILY_MESSAGE_LIMIT           free: replies per UTC day (default 5, 0 = unlimited) —
 *                                       below the monthly cap so it actually spreads use (OBS-1)
 *   COACH_MONTHLY_MESSAGE_LIMIT         free: replies per UTC month (default 10, 0 = unlimited)
 *   COACH_PREMIUM_DAILY_MESSAGE_LIMIT   premium: replies per UTC day (default 50, 0 = unlimited);
 *                                       premium has no monthly cap
 *
 *   MEAL_LOG_DAILY_LIMIT                free: AI meal parses per UTC day (default 30, 0 = unlimited)
 *   MEAL_LOG_PREMIUM_DAILY_LIMIT        premium: AI meal parses per UTC day (default 100, 0 = unlimited)
 *   VOICE_DAILY_LIMIT / VOICE_PREMIUM_DAILY_LIMIT  voice transcriptions per UTC day (defaults 40 / 150)
 *   DAY_INSIGHTS_DAILY_LIMIT / DAY_INSIGHTS_PREMIUM_DAILY_LIMIT    default 3 / 20
 *   WEEK_REPORT_DAILY_LIMIT / WEEK_REPORT_PREMIUM_DAILY_LIMIT      default 3 / 10
 *   PLAN_GENERATE_DAILY_LIMIT / PLAN_GENERATE_PREMIUM_DAILY_LIMIT  default 2 / 10
 *
 *   AI_DAILY_SPEND_LIMIT_USD            global: all AI off once today's recorded cost reaches this (default 5, 0 = off)
 *
 * Defaults are the free-tier allowance, so a deploy that forgets the env
 * vars stays cheap rather than open-ended.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AiFeature =
  | "coach"
  | "coach_summary"
  | "coach_memory"
  | "weekly_checkin"
  | "meal_log"
  | "voice"
  | "day_insights"
  | "week_report"
  | "plan_generate";

export async function recordAiUsage(
  supabase: Supabase,
  userId: string,
  feature: AiFeature,
  usage: LlmUsage
): Promise<void> {
  // Written with the service role: users have no insert right on ai_usage,
  // so they can't forge cost to trip the global spend cap (security audit #1).
  // Fills the reservation made by the quota check (AUD-09), or adds a row.
  const db = createAdminClient();
  if (!db) {
    console.error("[ai_usage] SUPABASE_SECRET_KEY missing — usage not recorded, caps can't count this call");
    return;
  }
  void supabase;
  const { error } = await db.rpc("record_ai_usage", {
    p_user: userId,
    p_feature: feature,
    p_provider: usage.provider,
    p_model: usage.model,
    p_input: usage.inputTokens,
    p_cached: usage.cachedTokens,
    p_output: usage.outputTokens,
    p_cost: usage.costUsd,
  });
  // Metering must never fail the user's request; the log shows the gap.
  if (error) console.error(`[ai_usage] record failed: ${error.message}`);
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
    : limit("COACH_DAILY_MESSAGE_LIMIT", 5);
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
    .eq("status", "done")
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
  voice: ["VOICE", 40, 150],
  day_insights: ["DAY_INSIGHTS", 3, 20],
  week_report: ["WEEK_REPORT", 3, 10],
  plan_generate: ["PLAN_GENERATE", 2, 10],
  // Premium-only feature: free 0 (also gated by isPremium); regenerations are rare.
  weekly_checkin: ["WEEKLY_CHECKIN", 0, 3],
};

const CAP_MESSAGES: Partial<Record<AiFeature, string>> = {
  voice: "You've reached today's voice limit. You can still type, or try again tomorrow.",
  meal_log: "You've reached today's AI logging limit. You can still log from the food search, or try again tomorrow.",
};

let spendCache: { at: number; over: boolean } | null = null;

/**
 * Global kill switch (GTM G1): true once today's total recorded AI cost
 * (UTC) reaches AI_DAILY_SPEND_LIMIT_USD. Cached for a minute per instance;
 * fails closed (AUD-09). Complements the gateway key's own spend cap.
 */
export async function aiSpendExceeded(supabase: Supabase): Promise<boolean> {
  const raw = process.env.AI_DAILY_SPEND_LIMIT_USD;
  const cap = raw == null || raw === "" ? 5 : Number(raw);
  if (!(cap > 0)) return false;
  if (spendCache && Date.now() - spendCache.at < 60_000) return spendCache.over;
  // Platform-wide spend: service role only (users can't call ai_spend_today).
  const db = createAdminClient();
  void supabase;
  // Fail closed (AUD-09): without a working spend check there is no cap at all.
  if (!db) {
    console.error("[ai_usage] SUPABASE_SECRET_KEY missing — AI paused: the spend cap can't be checked");
    return true;
  }
  const { data, error } = await db.rpc("ai_spend_today");
  if (error) {
    console.error(`[ai_usage] spend check failed, AI paused: ${error.message}`);
    return true;
  }
  const over = Number(data) >= cap;
  if (over) console.warn(`[ai_usage] daily spend ${Number(data).toFixed(2)} USD reached the ${cap} USD limit`);
  spendCache = { at: Date.now(), over };
  return over;
}

type Reservation = "ok" | "daily" | "monthly" | "error";

/**
 * Atomically count and reserve one call against the caps (AUD-09): parallel
 * requests can no longer all pass a check made before any of them recorded
 * usage. "error" = the reservation couldn't be made; callers fail closed.
 */
async function reserve(userId: string, feature: AiFeature, daily: number | null, monthly: number | null): Promise<Reservation> {
  const db = createAdminClient();
  if (!db) {
    console.error("[ai_usage] SUPABASE_SECRET_KEY missing — AI paused: caps can't be enforced");
    return "error";
  }
  const { data, error } = await db.rpc("reserve_ai_call", {
    p_user: userId,
    p_feature: feature,
    p_daily: daily,
    p_monthly: monthly,
  });
  if (error || (data !== "ok" && data !== "daily" && data !== "monthly")) {
    console.error(`[ai_usage] reservation failed: ${error?.message ?? String(data)}`);
    return "error";
  }
  return data;
}

const UNAVAILABLE = "AI features are temporarily unavailable. Try again later.";

/** Null when within the feature's daily cap (one call reserved), otherwise a user-facing reason. */
export async function featureQuotaError(
  supabase: Supabase,
  userId: string,
  feature: AiFeature,
  premium: boolean
): Promise<string | null> {
  // The invite-only beta is enforced here too, not only by page redirects:
  // AI endpoints are callable directly by any signed-in account (audit #5).
  if (!(await ensureBetaAccess(supabase, userId))) return "AI features need beta access. Redeem an invite code first.";
  if (await aiSpendExceeded(supabase)) return UNAVAILABLE;
  const cap = DAILY_CAPS[feature];
  if (!cap) return null;
  const [prefix, free, paid] = cap;
  const daily = premium
    ? limit(`${prefix}_PREMIUM_DAILY_LIMIT`, paid)
    : limit(`${prefix}_DAILY_LIMIT`, free);
  if (daily == null) return null;
  const r = await reserve(userId, feature, daily, null);
  if (r === "ok") return null;
  if (r === "error") return UNAVAILABLE;
  return CAP_MESSAGES[feature] ?? "You've reached today's limit for this AI feature. Try again tomorrow.";
}

/** Null when within limits, otherwise which cap was hit (translated by the chat). */
export async function coachQuotaError(
  supabase: Supabase,
  userId: string,
  premium: boolean
): Promise<"dailyLimit" | "monthlyLimit" | "invite" | "unavailable" | null> {
  if (!(await ensureBetaAccess(supabase, userId))) return "invite";
  const daily = premium
    ? limit("COACH_PREMIUM_DAILY_MESSAGE_LIMIT", 50)
    : limit("COACH_DAILY_MESSAGE_LIMIT", 5);
  const monthly = premium ? null : limit("COACH_MONTHLY_MESSAGE_LIMIT", 10);
  if (daily == null && monthly == null) return null;
  const r = await reserve(userId, "coach", daily, monthly);
  return r === "ok" ? null : r === "daily" ? "dailyLimit" : r === "monthly" ? "monthlyLimit" : "unavailable";
}
