import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Verify the JWT and return an authed client + user id, or redirect to login.
 * cache() dedupes across layout + page within a single request.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");
  return { supabase, userId: claims.sub as string, claims };
});

export const getProfile = cache(
  async (): Promise<{
    supabase: Awaited<ReturnType<typeof createClient>>;
    userId: string;
    profile: Profile;
  }> => {
    const { supabase, userId, claims } = await requireUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (profile) return { supabase, userId, profile: profile as Profile };

    // No row: the user predates the handle_new_user trigger (or it wasn't
    // applied). Create it here — redirecting to /login while authenticated
    // loops forever, because the proxy bounces logged-in users back.
    const metadata = claims.user_metadata as Record<string, unknown> | undefined;
    const { data: created, error: upsertError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        email: (claims.email as string | undefined) ?? null,
        full_name: typeof metadata?.full_name === "string" ? metadata.full_name : null,
      })
      .select()
      .single();
    if (upsertError || !created) {
      throw new Error(`Signed in but could not load or create profile: ${upsertError?.message}`);
    }
    return { supabase, userId, profile: created as Profile };
  }
);

export async function isAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/** For admin pages and actions: redirect non-admins away. */
export async function requireAdmin() {
  const { supabase, userId } = await requireUser();
  if (!(await isAdmin(supabase, userId))) redirect("/dashboard");
  return { supabase, userId };
}
