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
  const back = (err: string) => redirect(`/invite?error=${err}&code=${encodeURIComponent(code)}`);
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) back("invalid");

  const { data, error } = await supabase.rpc("redeem_invite", { p_code: code, p_source: await readSource() });
  if (error) back("generic");
  if (data === "ok" || data === "premium" || data === "already") {
    (await cookies()).delete(INVITE_COOKIE);
    // Existing members land on Me, where the Premium badge confirms the grant.
    redirect(data === "ok" ? "/onboarding" : `/account?message=${encodeURIComponent(data === "premium" ? "codePremium" : "codeNothing")}`);
  }
  back(String(data ?? "invalid"));
}
