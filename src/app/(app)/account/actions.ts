"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export async function changePassword(formData: FormData) {
  const { supabase } = await requireUser();

  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    redirect(
      `/account?error=${encodeURIComponent("Password must be at least 8 characters.")}`
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/account?error=${encodeURIComponent(error.message)}`);

  redirect(`/account?message=${encodeURIComponent("Password updated.")}`);
}

/**
 * Self-service account deletion (GDPR). The delete_account() RPC removes the
 * auth user; every table cascades from it (profile, diary, weight logs,
 * favorites, recipes, private foods).
 */
export async function deleteAccount(formData: FormData) {
  const { supabase } = await requireUser();

  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== "delete") {
    redirect(
      `/account?error=${encodeURIComponent('Type "delete" to confirm deleting your account.')}`
    );
  }

  const { error } = await supabase.rpc("delete_account");
  if (error) redirect(`/account?error=${encodeURIComponent(error.message)}`);

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/login?message=${encodeURIComponent("Your account and all its data are gone.")}`);
}
