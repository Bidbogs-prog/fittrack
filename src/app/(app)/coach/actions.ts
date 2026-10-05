"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";

// Sending a message lives in the streaming route handler: src/app/api/coach/route.ts.

/** Thumbs up/down on a coach reply, stored on the message payload (no content copied). */
export async function rateCoachMessage(id: string, rating: "up" | "down" | null): Promise<void> {
  const { supabase, userId } = await getProfile();
  if (typeof id !== "string" || !id || !(rating === "up" || rating === "down" || rating === null)) return;
  // RLS limits this to the user's own conversations; the join keeps it explicit.
  const { data } = await supabase
    .from("coach_messages")
    .select("payload, conversation:coach_conversations!inner(user_id)")
    .eq("id", id)
    .eq("role", "assistant")
    .eq("conversation.user_id", userId)
    .maybeSingle();
  if (!data) return;
  const payload = { ...((data.payload as Record<string, unknown> | null) ?? {}), feedback: rating };
  await supabase.from("coach_messages").update({ payload }).eq("id", id);
}

export async function deleteCoachConversation(fd: FormData): Promise<void> {
  const { supabase, userId } = await getProfile();
  const id = fd.get("id");
  if (typeof id !== "string" || !id) return;
  await supabase.from("coach_conversations").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/coach");
}
