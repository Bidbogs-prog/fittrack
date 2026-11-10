import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS. Server-only, and only for jobs with no
 * signed-in user (the reminder cron). Never import from client code or use
 * for anything a user request could steer. Null when SUPABASE_SECRET_KEY
 * isn't configured.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (typeof window !== "undefined" || !url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
