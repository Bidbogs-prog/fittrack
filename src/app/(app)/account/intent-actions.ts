"use server";

import { requireUser } from "@/lib/auth";

/** Fake-door intent (GTM G2): first tap per kind is recorded on the profile. */
export async function registerIntent(kind: "premium" | "native", os: "ios" | "android" | "other"): Promise<void> {
  const { supabase, userId } = await requireUser();
  if (kind !== "premium" && kind !== "native") return;
  const patch =
    kind === "premium"
      ? { premium_intent_at: new Date().toISOString() }
      : { native_intent_at: new Date().toISOString(), native_intent_os: ["ios", "android", "other"].includes(os) ? os : "other" };
  const column = kind === "premium" ? "premium_intent_at" : "native_intent_at";
  await supabase.from("profiles").update(patch).eq("id", userId).is(column, null);
}
