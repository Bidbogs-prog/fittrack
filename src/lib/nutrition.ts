import type { ActivityLevel, Food, Gender, Goal, Profile } from "./types";

/**
 * Single source of truth for all nutrition math.
 * BMR uses the Mifflin-St Jeor equation; TDEE = BMR x activity multiplier.
 */

export const ACTIVITY_LEVELS: Record<
  ActivityLevel,
  { label: string; detail: string; multiplier: number }
> = {
  sedentary: { label: "Sedentary", detail: "Desk job, little or no exercise", multiplier: 1.2 },
  light: { label: "Lightly active", detail: "Gym 1-3 times a week", multiplier: 1.375 },
  moderate: { label: "Moderately active", detail: "Gym 3-5 times a week", multiplier: 1.55 },
  active: { label: "Very active", detail: "Hard training 6-7 days a week", multiplier: 1.725 },
  athlete: { label: "Athlete", detail: "Twice daily training or physical job", multiplier: 1.9 },
};

export const GOALS: Record<
  Goal,
  { label: string; detail: string; kcalDelta: number; proteinPerKg: number }
> = {
  lose: { label: "Lose fat", detail: "-500 kcal a day, high protein", kcalDelta: -500, proteinPerKg: 2.2 },
  maintain: { label: "Maintain", detail: "Eat at your TDEE", kcalDelta: 0, proteinPerKg: 1.8 },
  gain: { label: "Build muscle", detail: "+350 kcal a day lean surplus", kcalDelta: 350, proteinPerKg: 2.0 },
};

export function ageFromBirthDate(birthDate: string, today = new Date()): number {
  const dob = new Date(birthDate);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function calcBmr(gender: Gender, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(gender === "male" ? base + 5 : base - 161);
}

export function calcTdee(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_LEVELS[activity].multiplier);
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface EnergyProfile extends Macros {
  bmr: number;
  tdee: number;
  goal: Goal;
}

/**
 * Daily targets: calories from TDEE +/- goal delta (floor 1200),
 * protein per kg bodyweight, fat 25% of calories, carbs the remainder,
 * fibre 14 g per 1000 kcal.
 */
export function calcTargets(profile: Profile): EnergyProfile | null {
  const { gender, birth_date, height_cm, weight_kg, activity_level } = profile;
  if (!gender || !birth_date || !height_cm || !weight_kg || !activity_level) return null;

  const goal: Goal = profile.goal ?? "maintain";
  const bmr = calcBmr(gender, weight_kg, height_cm, ageFromBirthDate(birth_date));
  const tdee = calcTdee(bmr, activity_level);
  const kcal = Math.max(1200, tdee + GOALS[goal].kcalDelta);

  const protein = Math.round(GOALS[goal].proteinPerKg * weight_kg);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fibre = Math.round((kcal / 1000) * 14);

  return { bmr, tdee, kcal, protein, carbs, fat, fibre, goal };
}

/** Scale a food's per-100 g facts to a portion in grams. */
export function macrosForPortion(food: Food, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: food.kcal * f,
    protein: food.protein_g * f,
    carbs: food.carbs_g * f,
    fat: food.fat_g * f,
    fibre: food.fibre_g * f,
  };
}

export function sumMacros(portions: Macros[]): Macros {
  return portions.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
      fibre: acc.fibre + m.fibre,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
  );
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
