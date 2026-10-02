"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";

// Sending a message lives in the streaming route handler: src/app/api/coach/route.ts.

export async function deleteCoachConversation(fd: FormData): Promise<void> {
  const { supabase, userId } = await getProfile();
  const id = fd.get("id");
  if (typeof id !== "string" || !id) return;
  await supabase.from("coach_conversations").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/coach");
}
