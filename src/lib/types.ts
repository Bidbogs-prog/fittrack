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
  onboarded: boolean;
}

/** All nutritional facts are per 100 g. */
export interface Food {
  id: string;
  name: string;
  brand: string | null;
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
