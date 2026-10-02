import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Server-side premium check (roadmap 1.6 E). The single source of truth for
 * every gated feature — UI gating is never security. Active row with no end
 * date (manual grant) or an end date in the future = premium.
 *
 * Fails closed to free: if the lookup errors (e.g. the migration hasn't run
 * yet), the user just gets the free allowance.
 */
export async function isPremium(supabase: Supabase, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("entitlements")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data || data.status !== "active") return false;
  const end = data.current_period_end as string | null;
  return end == null || new Date(end).getTime() > Date.now();
}
