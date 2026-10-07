"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { INVITE_COOKIE, readSource } from "@/lib/beta";

/** Redeem a beta invite code for the signed-in user (GTM G1). */
export async function redeemInvite(formData: FormData) {
  const { supabase } = await requireUser();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) redirect("/invite?error=invalid");

  const { data, error } = await supabase.rpc("redeem_invite", { p_code: code, p_source: await readSource() });
  if (error) redirect("/invite?error=generic");
  if (data === "ok" || data === "already") {
    (await cookies()).delete(INVITE_COOKIE);
    redirect("/onboarding");
  }
  redirect(`/invite?error=${encodeURIComponent(String(data ?? "invalid"))}`);
}
