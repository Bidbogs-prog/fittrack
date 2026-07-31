"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { MACRO_PCT_MAX, MACRO_PCT_MIN } from "@/lib/nutrition";
import type { ActivityLevel, Gender, Goal } from "@/lib/types";

const GENDERS: Gender[] = ["male", "female"];
const LEVELS: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "athlete"];
const GOALS: Goal[] = ["lose", "maintain", "gain"];

/** null = coach formula, invalid = reject, otherwise a 100%-sum split. */
function parseMacroSplit(
  formData: FormData
): { protein: number; carbs: number; fat: number } | null | "invalid" {
  if (String(formData.get("macro_mode") ?? "auto") === "auto") return null;

  const pct = (name: string) => {
    const n = Number(formData.get(name));
    return Number.isInteger(n) && n >= MACRO_PCT_MIN && n <= MACRO_PCT_MAX ? n : NaN;
  };
  const protein = pct("protein_pct");
  const carbs = pct("carbs_pct");
  const fat = pct("fat_pct");
  if ([protein, carbs, fat].some(Number.isNaN) || protein + carbs + fat !== 100) {
    return "invalid";
  }
  return { protein, carbs, fat };
}

export async function completeOnboarding(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const gender = String(formData.get("gender") ?? "") as Gender;
  const birthDate = String(formData.get("birth_date") ?? "");
  const heightCm = Number(formData.get("height_cm"));
  const weightKg = Number(formData.get("weight_kg"));
  const activity = String(formData.get("activity_level") ?? "") as ActivityLevel;
  const goal = String(formData.get("goal") ?? "") as Goal;

  const age = birthDate ? (Date.now() - new Date(birthDate).getTime()) / 3.15576e10 : 0;

  const split = parseMacroSplit(formData);

  const invalid =
    !GENDERS.includes(gender) ||
    !LEVELS.includes(activity) ||
    !GOALS.includes(goal) ||
    split === "invalid" ||
    !(age >= 13 && age <= 100) ||
    !(heightCm >= 90 && heightCm <= 260) ||
    !(weightKg >= 25 && weightKg <= 400);

  if (invalid) {
    redirect("/onboarding?error=Please double-check your details — some values look off.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      gender,
      birth_date: birthDate,
      height_cm: heightCm,
      weight_kg: weightKg,
      activity_level: activity,
      goal,
      protein_pct: split?.protein ?? null,
      carbs_pct: split?.carbs ?? null,
      fat_pct: split?.fat ?? null,
      onboarded: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
