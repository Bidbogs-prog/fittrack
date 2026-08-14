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
  /**
   * Optional intermittent-fasting eating window ("HH:MM:SS", local time);
   * both set or both null. start > end means the window wraps midnight.
   */
  eating_window_start: string | null;
  eating_window_end: string | null;
  /** Display units; storage is always metric (see src/lib/units.ts). */
  units: Units;
  onboarded: boolean;
}

export type Units = "metric" | "imperial";

export interface WaterLog {
  user_id: string;
  log_date: string;
  ml: number;
}

export interface ExerciseLog {
  id: string;
  user_id: string;
  log_date: string;
  name: string;
  minutes: number | null;
  kcal: number;
}

export interface StepLog {
  user_id: string;
  log_date: string;
  steps: number;
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
  /** null = global library food; set = private food visible to its owner only. */
  owner_id: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  /**
   * Optional household serving ("1 cup", "1 medium egg") as a portion
   * shortcut; null = unknown. Grams stay the source of truth.
   */
  serving_name: string | null;
  serving_grams: number | null;
}

/**
 * A diary entry is either a food portion (`food_id` + `grams`) or a macro
 * snapshot (`quick_name` + `quick_kcal`): manual quick-adds and logged
 * recipes. Recipe entries snapshot macros at log time and keep
 * `recipe_id` + `servings` for display. Helpers live in `src/lib/diary.ts`.
 */
export interface DiaryEntry {
  id: string;
  user_id: string;
  entry_date: string;
  meal: MealType;
  food_id: string | null;
  grams: number | null;
  food: Food | null;
  recipe_id: string | null;
  servings: number | null;
  quick_name: string | null;
  quick_kcal: number | null;
  quick_protein_g: number | null;
  quick_carbs_g: number | null;
  quick_fat_g: number | null;
  quick_fibre_g: number | null;
}

/**
 * Persisted AI coach output (roadmap 1.3): scope "day" keys on the diary
 * date, scope "week" on the analysed week's Monday. payload holds the
 * rendered JSON (DayInsights / WeekReport).
 */
export type InsightScope = "day" | "week";

export interface AiInsightRow {
  id: string;
  user_id: string;
  scope: InsightScope;
  period_start: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
}

/**
 * Conversational AI coach (roadmap 1.6). A conversation's `summary` is a
 * rolling recap of turns older than the verbatim window; a message's
 * `payload` records guardrail state for that turn (e.g. restricted mode).
 */
export type CoachRole = "user" | "assistant";

export interface CoachConversation {
  id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoachMessage {
  id: string;
  conversation_id: string;
  role: CoachRole;
  content: string;
  payload: unknown;
  created_at: string;
}

export interface WeightLog {
  id: string;
  user_id: string;
  log_date: string;
  weight_kg: number;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  /** How many servings the full ingredient list makes. */
  servings: number;
  items: RecipeItem[];
}

export interface RecipeItem {
  id: string;
  recipe_id: string;
  food_id: string;
  grams: number;
  food: Food;
}

/**
 * A saved meal is a named snapshot of one meal's diary rows, re-applied to
 * any day/meal in one tap. Items mirror the DiaryEntry payload: a food
 * portion (food_id + grams) or a macro snapshot (quick_name + quick_kcal).
 */
export interface SavedMeal {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  items: SavedMealItem[];
}

export interface SavedMealItem {
  id: string;
  saved_meal_id: string;
  food_id: string | null;
  grams: number | null;
  food: Food | null;
  recipe_id: string | null;
  servings: number | null;
  quick_name: string | null;
  quick_kcal: number | null;
  quick_protein_g: number | null;
  quick_carbs_g: number | null;
  quick_fat_g: number | null;
  quick_fibre_g: number | null;
}

export interface MealPlan {
  id: string;
  name: string;
  goal: Goal;
  description: string | null;
  /** null = global admin-authored plan; set = private AI-generated plan. */
  owner_id: string | null;
  /** Set = admin handed this plan to one user; it is visible only to them. */
  assigned_to: string | null;
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

export type PlanRequestStatus = "pending" | "fulfilled" | "dismissed";

/** A user's ask for a coach-built meal plan, fulfilled from /admin/requests. */
export interface PlanRequest {
  id: string;
  user_id: string;
  /** Requester identity snapshotted at request time (admins can't read profiles). */
  email: string;
  full_name: string | null;
  goal: Goal | null;
  note: string | null;
  status: PlanRequestStatus;
  /** The plan assigned in response (null until fulfilled, or if since deleted). */
  plan_id: string | null;
  created_at: string;
  resolved_at: string | null;
}
