"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

/** Forget one remembered fact (or all of them). Own rows only (RLS + filter). */
export async function forgetMemory(id: string | null): Promise<void> {
  const { supabase, userId } = await requireUser();
  const q = supabase.from("coach_memories").delete().eq("user_id", userId);
  await (id ? q.eq("id", id) : q);
  revalidatePath("/account");
}
