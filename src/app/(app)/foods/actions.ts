"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/auth";
import { statusUrl } from "@/i18n/status";
import { parseUserFood } from "@/lib/user-food";

export async function createUserFood(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const fromScan = formData.get("from") === "scan";
  // Keep what the scan prefilled when bouncing back with an error (AUD-13).
  const keep = new URLSearchParams();
  if (fromScan) keep.set("from", "scan");
  for (const k of ["barcode", "name"] as const) {
    const v = String(formData.get(k) ?? "").trim().slice(0, 120);
    if (v) keep.set(k, v);
  }
  const back = `/foods/new?${keep.toString()}${keep.size ? "&" : ""}`;

  const parsed = parseUserFood(formData);
  if ("error" in parsed) {
    redirect(`${back}error=${parsed.error}`);
  }

  const admin = await isAdmin(supabase, userId);
  const { data, error } = await supabase
    .from("foods")
    .insert(
      admin
        ? { ...parsed.values, owner_id: null, source: "manual" }
        : { ...parsed.values, owner_id: userId, source: "manual", review_status: "pending" }
    )
    .select("id")
    .single();
  if (error || !data) {
    redirect(`${back}error=${error?.code === "23505" ? "barcodeTaken" : "couldNotSave"}`);
  }

  revalidatePath("/foods");
  // From a barcode miss: straight to the food so it can be logged.
  redirect(fromScan ? `/foods/${data.id}` : admin ? "/foods" : "/foods?mine=1");
}

export async function updateUserFood(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/foods");

  const parsed = parseUserFood(formData);
  if ("error" in parsed) {
    redirect(statusUrl(`/foods/${id}/edit`, "error", parsed.error));
  }

  // RLS also enforces ownership; the filter keeps intent explicit.
  const { error } = await supabase
    .from("foods")
    // Edited facts go back to the review queue (also resubmits a rejected food).
    .update({ ...parsed.values, review_status: "pending", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) redirect(statusUrl(`/foods/${id}/edit`, "error", "couldNotSave"));

  revalidatePath("/foods");
  revalidatePath("/dashboard");
  redirect("/foods?mine=1");
}

export async function deleteUserFood(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("foods").delete().eq("id", id).eq("owner_id", userId);

  revalidatePath("/foods");
  revalidatePath("/dashboard");
  redirect("/foods?mine=1");
}
