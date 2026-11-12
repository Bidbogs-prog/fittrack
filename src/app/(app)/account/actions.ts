"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { LOCALES, LOCALE_COOKIE } from "@/i18n/request";
import { MACRO_PCT_MAX, MACRO_PCT_MIN } from "@/lib/nutrition";
import { authErrorKey, statusUrl } from "@/i18n/status";

// Status keys, never prose or database error text (AUD-17): the page
// translates them and refuses anything else.
const fail = (key: Parameters<typeof statusUrl>[2]): never => redirect(statusUrl("/account", "error", key));
const done = (key: Parameters<typeof statusUrl>[2]): never => redirect(statusUrl("/account", "message", key));

/** Switch the app language (roadmap 2.3) — cookie-based, per device. */
export async function setLocale(formData: FormData) {
  await requireUser();

  const locale = String(formData.get("locale") ?? "");
  if (!(LOCALES as readonly string[]).includes(locale)) redirect("/account");

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  revalidatePath("/", "layout");
  redirect("/account");
}

export async function changePassword(formData: FormData) {
  const { supabase } = await requireUser();

  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    fail("passwordTooShort");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail(authErrorKey(error));

  done("passwordUpdated");
}

/** Switch display units (roadmap 2.2). Storage stays metric everywhere. */
export async function saveUnits(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const units = String(formData.get("units") ?? "");
  if (units !== "metric" && units !== "imperial") {
    fail("unitsInvalid");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ units, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) fail("couldNotSave");

  revalidatePath("/", "layout");
  done(units === "imperial" ? "unitsImperial" : "unitsMetric");
}

/** Save or clear the optional intermittent-fasting eating window (roadmap 1.5). */
export async function saveFastingWindow(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const start = String(formData.get("start") ?? "").trim();
  const end = String(formData.get("end") ?? "").trim();
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  if ((start === "") !== (end === "")) {
    fail("fastingBothTimes");
  }
  if (start !== "" && (!TIME_RE.test(start) || !TIME_RE.test(end) || start === end)) {
    fail("fastingDifferentTimes");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      eating_window_start: start || null,
      eating_window_end: end || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) fail("couldNotSave");

  revalidatePath("/dashboard");
  done(start ? "fastingSaved" : "fastingDisabled");
}

/**
 * Save the macro split from the Me page's draggable bar, or reset to the
 * coach formula (mode "auto" = all three null). Same bounds as onboarding
 * and the DB check: integers in [MACRO_PCT_MIN, MACRO_PCT_MAX] summing to 100.
 */
export async function saveMacroSplit(formData: FormData) {
  const { supabase, userId } = await requireUser();

  let split: { protein_pct: number | null; carbs_pct: number | null; fat_pct: number | null } = {
    protein_pct: null,
    carbs_pct: null,
    fat_pct: null,
  };
  if (String(formData.get("mode") ?? "") !== "auto") {
    const pct = (name: string) => {
      const n = Number(formData.get(name));
      return Number.isInteger(n) && n >= MACRO_PCT_MIN && n <= MACRO_PCT_MAX ? n : NaN;
    };
    const protein = pct("protein_pct");
    const carbs = pct("carbs_pct");
    const fat = pct("fat_pct");
    if ([protein, carbs, fat].some(Number.isNaN) || protein + carbs + fat !== 100) {
      fail("macroSplitSum");
    }
    split = { protein_pct: protein, carbs_pct: carbs, fat_pct: fat };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ ...split, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) fail("couldNotSave");

  revalidatePath("/", "layout");
  done(split.protein_pct == null ? "macroSplitAuto" : "macroSplitSaved");
}

/**
 * Self-service account deletion (GDPR). The delete_account() RPC removes the
 * auth user; every table cascades from it (profile, diary, weight logs,
 * favorites, recipes, private foods).
 */
export async function deleteAccount(formData: FormData) {
  const { supabase } = await requireUser();

  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== "delete") {
    fail("confirmDelete");
  }

  const { error } = await supabase.rpc("delete_account");
  if (error) fail("couldNotSave");

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(statusUrl("/login", "message", "accountDeleted"));
}
