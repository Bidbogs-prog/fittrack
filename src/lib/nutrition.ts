import type { ActivityLevel, Food, Gender, Goal, MicroKey, MicroValues, Profile } from "./types";
import { MICRO_KEYS } from "./types";

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

/** Share of daily calories per macro, in percent. Must sum to 100. */
export interface MacroSplit {
  protein: number;
  carbs: number;
  fat: number;
}

/** Ratio presets offered in onboarding; "custom" is free-form on top of these. */
export const MACRO_PRESETS = [
  {
    key: "balanced",
    label: "Balanced",
    detail: "An even, sustainable middle ground.",
    split: { protein: 30, carbs: 40, fat: 30 },
  },
  {
    key: "highcarb",
    label: "Higher carb",
    detail: "Fuel-first for endurance or heavy training days.",
    split: { protein: 25, carbs: 50, fat: 25 },
  },
  {
    key: "lowcarb",
    label: "Low carb",
    detail: "Fat becomes the main fuel, carbs stay minimal.",
    split: { protein: 30, carbs: 20, fat: 50 },
  },
] as const;

/** Bounds for any custom percentage (also enforced by the DB check). */
export const MACRO_PCT_MIN = 5;
export const MACRO_PCT_MAX = 80;

/**
 * The user's saved macro split, or null when they use the coach formula
 * (protein per kg bodyweight, fat 25% of calories, carbs the remainder).
 */
export function macroSplitFromProfile(profile: Profile): MacroSplit | null {
  const { protein_pct, carbs_pct, fat_pct } = profile;
  if (protein_pct == null || carbs_pct == null || fat_pct == null) return null;
  if (protein_pct + carbs_pct + fat_pct !== 100) return null;
  return { protein: protein_pct, carbs: carbs_pct, fat: fat_pct };
}

export interface EnergyProfile extends Macros {
  bmr: number;
  tdee: number;
  goal: Goal;
}

/**
 * Daily targets: calories from TDEE +/- goal delta (floor 1200), fibre
 * 14 g per 1000 kcal. Macros come from the user's saved split when they
 * set one; otherwise the coach formula: protein per kg bodyweight,
 * fat 25% of calories, carbs the remainder.
 */
export function calcTargets(profile: Profile): EnergyProfile | null {
  const { gender, birth_date, height_cm, weight_kg, activity_level } = profile;
  if (!gender || !birth_date || !height_cm || !weight_kg || !activity_level) return null;

  const bmr = calcBmr(gender, weight_kg, height_cm, ageFromBirthDate(birth_date));
  return targetsFromTdee(profile, bmr, calcTdee(bmr, activity_level));
}

/**
 * Targets with the TDEE replaced by a measured estimate (adaptive TDEE,
 * roadmap 1.2 — see src/lib/adaptive.ts). Same goal delta, floor and
 * macro rules as calcTargets; only the energy baseline differs.
 */
export function calcTargetsWithTdee(profile: Profile, tdee: number): EnergyProfile | null {
  const { gender, birth_date, height_cm, weight_kg } = profile;
  if (!gender || !birth_date || !height_cm || !weight_kg) return null;
  const bmr = calcBmr(gender, weight_kg, height_cm, ageFromBirthDate(birth_date));
  return targetsFromTdee(profile, bmr, tdee);
}

function targetsFromTdee(profile: Profile, bmr: number, tdee: number): EnergyProfile {
  const goal: Goal = profile.goal ?? "maintain";
  const weight_kg = profile.weight_kg!;
  const kcal = Math.max(1200, tdee + GOALS[goal].kcalDelta);

  const split = macroSplitFromProfile(profile);
  let protein: number, carbs: number, fat: number;
  if (split) {
    protein = Math.round((kcal * split.protein) / 100 / 4);
    carbs = Math.round((kcal * split.carbs) / 100 / 4);
    fat = Math.round((kcal * split.fat) / 100 / 9);
  } else {
    protein = Math.round(GOALS[goal].proteinPerKg * weight_kg);
    fat = Math.round((kcal * 0.25) / 9);
    carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  }
  const fibre = Math.round((kcal / 1000) * 14);

  return { bmr, tdee, kcal, protein, carbs, fat, fibre, goal };
}

/** Daily water target: ~35 ml/kg, rounded to a 250 ml glass, kept sane. */
export function calcWaterTargetMl(weightKg: number | null): number {
  if (!weightKg) return 2000;
  return Math.min(4000, Math.max(1500, Math.round((weightKg * 35) / 250) * 250));
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

// ---------- Extended nutritional profile ----------

export type MicroGroup = "Fats, sugar & cholesterol" | "Minerals" | "Vitamins";

export interface MicronutrientDef {
  label: string;
  unit: "g" | "mg" | "µg";
  /** FDA adult daily value; null = no DV defined (trans fat, total sugars). */
  dv: number | null;
  group: MicroGroup;
  /** DV is an upper limit — being over it is bad, not good. */
  limit?: boolean;
}

export const MICRONUTRIENTS: Record<MicroKey, MicronutrientDef> = {
  saturated_fat_g: { label: "Saturated fat", unit: "g", dv: 20, group: "Fats, sugar & cholesterol", limit: true },
  trans_fat_g: { label: "Trans fat", unit: "g", dv: null, group: "Fats, sugar & cholesterol", limit: true },
  sugar_g: { label: "Sugars", unit: "g", dv: null, group: "Fats, sugar & cholesterol", limit: true },
  cholesterol_mg: { label: "Cholesterol", unit: "mg", dv: 300, group: "Fats, sugar & cholesterol", limit: true },
  sodium_mg: { label: "Sodium", unit: "mg", dv: 2300, group: "Minerals", limit: true },
  potassium_mg: { label: "Potassium", unit: "mg", dv: 4700, group: "Minerals" },
  calcium_mg: { label: "Calcium", unit: "mg", dv: 1300, group: "Minerals" },
  iron_mg: { label: "Iron", unit: "mg", dv: 18, group: "Minerals" },
  magnesium_mg: { label: "Magnesium", unit: "mg", dv: 420, group: "Minerals" },
  zinc_mg: { label: "Zinc", unit: "mg", dv: 11, group: "Minerals" },
  vitamin_a_ug: { label: "Vitamin A", unit: "µg", dv: 900, group: "Vitamins" },
  vitamin_c_mg: { label: "Vitamin C", unit: "mg", dv: 90, group: "Vitamins" },
  vitamin_d_ug: { label: "Vitamin D", unit: "µg", dv: 20, group: "Vitamins" },
  vitamin_e_mg: { label: "Vitamin E", unit: "mg", dv: 15, group: "Vitamins" },
  vitamin_k_ug: { label: "Vitamin K", unit: "µg", dv: 120, group: "Vitamins" },
  thiamin_mg: { label: "Thiamin (B1)", unit: "mg", dv: 1.2, group: "Vitamins" },
  riboflavin_mg: { label: "Riboflavin (B2)", unit: "mg", dv: 1.3, group: "Vitamins" },
  niacin_mg: { label: "Niacin (B3)", unit: "mg", dv: 16, group: "Vitamins" },
  vitamin_b6_mg: { label: "Vitamin B6", unit: "mg", dv: 1.7, group: "Vitamins" },
  folate_ug: { label: "Folate", unit: "µg", dv: 400, group: "Vitamins" },
  vitamin_b12_ug: { label: "Vitamin B12", unit: "µg", dv: 2.4, group: "Vitamins" },
};

export const MICRO_GROUPS: { group: MicroGroup; keys: MicroKey[] }[] = (
  ["Fats, sugar & cholesterol", "Minerals", "Vitamins"] as const
).map((group) => ({
  group,
  keys: MICRO_KEYS.filter((k) => MICRONUTRIENTS[k].group === group),
}));

/** Scale a food's extended facts to a portion in grams. Null stays null (unknown). */
export function microsForPortion(food: Food, grams: number): MicroValues {
  const f = grams / 100;
  return Object.fromEntries(
    MICRO_KEYS.map((k) => [k, food[k] == null ? null : food[k]! * f])
  ) as MicroValues;
}

/**
 * Sum portions per nutrient. Unknown (null) values are skipped; a total is
 * null only when no portion had data for that nutrient at all.
 */
export function sumMicros(portions: MicroValues[]): MicroValues {
  return Object.fromEntries(
    MICRO_KEYS.map((k) => {
      const known = portions.map((p) => p[k]).filter((v): v is number => v != null);
      return [k, known.length ? known.reduce((a, b) => a + b, 0) : null];
    })
  ) as MicroValues;
}

/** Percentage of the adult daily value, or null when the nutrient has no DV. */
export function percentDv(key: MicroKey, amount: number): number | null {
  const dv = MICRONUTRIENTS[key].dv;
  return dv ? Math.round((amount / dv) * 100) : null;
}

/** Compact display of a nutrient amount: 0.06, 4.7, 334. */
export function formatAmount(value: number): string {
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) return String(Math.round(value * 10) / 10);
  return String(Math.round(value * 100) / 100);
}
