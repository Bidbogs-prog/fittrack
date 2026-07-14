"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { ActivityLevel, Gender, Goal } from "@/lib/types";

const GENDERS: Gender[] = ["male", "female"];
const LEVELS: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "athlete"];
const GOALS: Goal[] = ["lose", "maintain", "gain"];

export async function completeOnboarding(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const gender = String(formData.get("gender") ?? "") as Gender;
  const birthDate = String(formData.get("birth_date") ?? "");
  const heightCm = Number(formData.get("height_cm"));
  const weightKg = Number(formData.get("weight_kg"));
  const activity = String(formData.get("activity_level") ?? "") as ActivityLevel;
  const goal = String(formData.get("goal") ?? "") as Goal;

  const age = birthDate ? (Date.now() - new Date(birthDate).getTime()) / 3.15576e10 : 0;

  const invalid =
    !GENDERS.includes(gender) ||
    !LEVELS.includes(activity) ||
    !GOALS.includes(goal) ||
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
