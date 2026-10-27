import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveTargets } from "@/lib/adaptive";
import { buildCoachContext } from "@/lib/coach/context";
import type { SafetyFlag } from "@/lib/coach/safety";
import { ACTIVITY_LEVELS, GOALS, ageFromBirthDate } from "@/lib/nutrition";
import type { Profile } from "@/lib/types";

/**
 * The requester's brief for a coach-built plan, snapshotted onto the plan
 * request (admins have no RLS path into profiles or diaries). Built from the
 * same context the AI coach sees, so the human coach has the same facts:
 * profile, targets, recent intake, frequent foods and favourites, weight
 * trend, training — plus the safety flags that must shape the plan.
 */
export interface PlanBrief {
  version: 1;
  capturedAt: string;
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: string | null;
  goal: string | null;
  units: string;
  eatingWindow: string | null;
  targets: { kcal: number; protein: number; carbs: number; fat: number; fibre: number; adaptive: boolean } | null;
  safety: { restricted: boolean; flags: SafetyFlag[] } | null;
  /** The coach's full plain-text context (recent days, meals, foods, weight, training). */
  context: string | null;
}

/**
 * Admin side: rebuild a pending request's brief from the requester's live
 * data and save it on the request. Works through the admin read policies
 * (migration 20260821000000), which only cover people with an open request.
 * Returns null if their profile isn't readable.
 */
export async function refreshRequestBrief(
  supabase: SupabaseClient,
  requestId: string,
  requesterId: string
): Promise<PlanBrief | null> {
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", requesterId).maybeSingle();
  if (!profile) return null;
  const brief = await buildPlanBrief(supabase, requesterId, profile as Profile);
  await supabase.from("plan_requests").update({ snapshot: brief }).eq("id", requestId).eq("status", "pending");
  return brief;
}

export async function buildPlanBrief(supabase: SupabaseClient, userId: string, profile: Profile): Promise<PlanBrief> {
  const base: PlanBrief = {
    version: 1,
    capturedAt: new Date().toISOString(),
    age: profile.birth_date ? ageFromBirthDate(profile.birth_date) : null,
    gender: profile.gender ?? null,
    heightCm: profile.height_cm ?? null,
    weightKg: profile.weight_kg ?? null,
    activity: profile.activity_level ? ACTIVITY_LEVELS[profile.activity_level].label : null,
    goal: profile.goal ? GOALS[profile.goal].label : null,
    units: profile.units,
    eatingWindow:
      profile.eating_window_start && profile.eating_window_end
        ? `${profile.eating_window_start.slice(0, 5)}–${profile.eating_window_end.slice(0, 5)}`
        : null,
    targets: null,
    safety: null,
    context: null,
  };

  const active = await getActiveTargets(supabase, userId, profile);
  if (!active) return base;
  const t = active.targets;
  base.targets = {
    kcal: Math.round(t.kcal),
    protein: Math.round(t.protein),
    carbs: Math.round(t.carbs),
    fat: Math.round(t.fat),
    fibre: Math.round(t.fibre),
    adaptive: active.adaptive != null,
  };
  // The coach context needs a birth date; under-18s are blocked there.
  if (!profile.birth_date) return base;
  try {
    const { context, safety } = await buildCoachContext(supabase, userId, profile, active);
    base.safety = { restricted: safety.restricted, flags: safety.flags };
    base.context = context.slice(0, 12_000);
  } catch {
    // Brief without the detailed context is still useful.
  }
  return base;
}
