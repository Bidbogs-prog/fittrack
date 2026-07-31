export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "athlete";
export type Goal = "lose" | "maintain" | "gain";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export type FoodCategory =
  | "protein"
  | "carbs"
  | "dairy"
  | "fruit"
  | "vegetables"
  | "fats-nuts"
  | "snacks"
  | "drinks"
  | "other";

export const FOOD_CATEGORIES: FoodCategory[] = [
  "protein",
  "carbs",
  "dairy",
  "fruit",
  "vegetables",
  "fats-nuts",
  "snacks",
  "drinks",
  "other",
];

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  gender: Gender | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  /**
   * Custom macro split as percent of daily calories; the three must sum
   * to 100. All null = use the default coach formula (see calcTargets).
   */
  protein_pct: number | null;
  carbs_pct: number | null;
  fat_pct: number | null;
  onboarded: boolean;
}

/**
 * Extended nutritional profile columns on `foods` — per 100 g, null = unknown.
 * Labels, units and daily values live in `nutrition.ts` (MICRONUTRIENTS).
 */
export const MICRO_KEYS = [
  "saturated_fat_g",
  "trans_fat_g",
  "sugar_g",
  "cholesterol_mg",
  "sodium_mg",
  "potassium_mg",
  "calcium_mg",
  "iron_mg",
  "magnesium_mg",
  "zinc_mg",
  "vitamin_a_ug",
  "vitamin_c_mg",
  "vitamin_d_ug",
  "vitamin_e_mg",
  "vitamin_k_ug",
  "thiamin_mg",
  "riboflavin_mg",
  "niacin_mg",
  "vitamin_b6_mg",
  "folate_ug",
  "vitamin_b12_ug",
] as const;

export type MicroKey = (typeof MICRO_KEYS)[number];
export type MicroValues = Record<MicroKey, number | null>;

/** Where a food row came from: hand-curated, Open Food Facts, or USDA import. */
export type FoodSource = "manual" | "off" | "usda";

/** All nutritional facts are per 100 g. */
export interface Food extends MicroValues {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  source: FoodSource;
  category: FoodCategory;
  image_url: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
}

export interface DiaryEntry {
  id: string;
  user_id: string;
  entry_date: string;
  meal: MealType;
  food_id: string;
  grams: number;
  food: Food;
}

export interface MealPlan {
  id: string;
  name: string;
  goal: Goal;
  description: string | null;
  items: MealPlanItem[];
}

export interface MealPlanItem {
  id: string;
  plan_id: string;
  meal: MealType;
  food_id: string;
  grams: number;
  food: Food;
}
