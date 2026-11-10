"use server";

import { requireUser } from "@/lib/auth";

/** First-run tour finished or skipped: don't show it again on any device. */
export async function completeTour(): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("profiles").update({ tour_completed_at: new Date().toISOString() }).eq("id", userId);
}
