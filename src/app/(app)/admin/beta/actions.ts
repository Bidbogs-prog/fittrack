"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

const back = (q: string) => redirect(`/admin/beta?${q}`);

/** Create an invite code (GTM G1). Blank code = random SO3RA-XXXXXX. */
export async function createInviteCode(formData: FormData) {
  const { supabase } = await requireAdmin();
  const raw = String(formData.get("code") ?? "").trim().toUpperCase();
  const code = raw || `SO3RA-${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) back("error=Codes are 4–32 letters, digits or dashes.");
  const maxUses = Math.round(Number(formData.get("max_uses") ?? 1));
  const premiumDays = Math.round(Number(formData.get("premium_days") ?? 90));
  const expiresDays = Number(formData.get("expires_days") ?? 0);
  if (!(maxUses >= 1 && maxUses <= 100000) || !(premiumDays >= 0 && premiumDays <= 3650)) {
    back("error=Check max uses (1–100000) and premium days (0–3650).");
  }
  const { error } = await supabase.from("invite_codes").insert({
    code,
    label: String(formData.get("label") ?? "").trim().slice(0, 80) || null,
    max_uses: maxUses,
    premium_days: premiumDays,
    expires_at: expiresDays > 0 ? new Date(Date.now() + expiresDays * 86_400_000).toISOString() : null,
  });
  if (error) back(`error=${encodeURIComponent(error.code === "23505" ? "That code already exists." : error.message)}`);
  revalidatePath("/admin/beta");
  back(`created=${encodeURIComponent(code)}`);
}

/** Admit the next N waitlist entries in queue order (referrals first). */
export async function admitWaitlist(formData: FormData) {
  const { supabase } = await requireAdmin();
  const n = Math.round(Number(formData.get("count") ?? 0));
  if (!(n >= 1 && n <= 1000)) back("error=Admit between 1 and 1000 at a time.");
  const { data, error } = await supabase.rpc("admit_waitlist", { p_count: n });
  if (error) back(`error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/beta");
  back(`admitted=${Number(data ?? 0)}`);
}
