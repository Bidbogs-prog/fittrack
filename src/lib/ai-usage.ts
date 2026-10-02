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

/** Null when within limits, otherwise a user-facing reason. */
export async function coachQuotaError(
  supabase: Supabase,
  userId: string,
  premium: boolean
): Promise<string | null> {
  const daily = premium
    ? limit("COACH_PREMIUM_DAILY_MESSAGE_LIMIT", 50)
    : limit("COACH_DAILY_MESSAGE_LIMIT", 10);
  const monthly = premium ? null : limit("COACH_MONTHLY_MESSAGE_LIMIT", 30);
  if (daily == null && monthly == null) return null;

  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const since = monthly != null ? monthStart : dayStart;

  const { data, error } = await supabase
    .from("ai_usage")
    .select("created_at")
    .eq("user_id", userId)
    .eq("feature", "coach")
    .gte("created_at", since.toISOString());
  // Fail open: a metering outage shouldn't lock paying users out.
  if (error || !data) return null;

  if (monthly != null && data.length >= monthly) {
    return "You've used this month's coach messages. They reset on the 1st.";
  }
  if (daily != null) {
    const today = data.filter((r) => new Date(r.created_at as string) >= dayStart).length;
    if (today >= daily) return "You've reached today's coach message limit. Try again tomorrow.";
  }
  return null;
}
