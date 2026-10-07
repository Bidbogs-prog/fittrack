import { cache } from "react";
import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Invite-gated beta (roadmap GTM G1). On unless BETA_INVITE_ONLY=0.
 * Existing accounts were grandfathered by the migration; new ones need a
 * redeemed invite code or an admitted waitlist email.
 */
export function betaGateOn(): boolean {
  return process.env.BETA_INVITE_ONLY !== "0";
}

export const SOURCE_COOKIE = "so3ra_src";
export const INVITE_COOKIE = "so3ra_invite";

/** First-touch attribution captured by <SourceCapture /> (utm_*, ref, landing). */
export async function readSource(): Promise<Record<string, string> | null> {
  const raw = (await cookies()).get(SOURCE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && /^[a-z_]{1,20}$/.test(k)) out[k] = v.slice(0, 100);
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/**
 * True when the user may use the app. Tries the admitted-waitlist path on
 * the way (no code needed for admitted emails). Cached per request.
 */
export const ensureBetaAccess = cache(async (supabase: Supabase, userId: string): Promise<boolean> => {
  if (!betaGateOn()) return true;
  const { data, error } = await supabase.from("beta_access").select("user_id").eq("user_id", userId).maybeSingle();
  // Fail open if the table isn't there yet (migration not pushed).
  if (error) return true;
  if (data) return true;
  const { data: claimed } = await supabase.rpc("claim_waitlist_access", { p_source: await readSource() });
  return claimed === true;
});

export interface BetaInfo {
  via: string | null;
  inviteCode: string | null;
  source: Record<string, string> | null;
}

export async function getBetaInfo(supabase: Supabase, userId: string): Promise<BetaInfo> {
  const { data } = await supabase
    .from("beta_access")
    .select("via, invite_code, source")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    via: (data?.via as string | undefined) ?? null,
    inviteCode: (data?.invite_code as string | null | undefined) ?? null,
    source: (data?.source as Record<string, string> | null | undefined) ?? null,
  };
}
