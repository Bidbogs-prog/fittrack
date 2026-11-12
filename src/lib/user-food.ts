import { FOOD_CATEGORIES, type FoodCategory } from "./types";
import type { StatusKey } from "@/i18n/status";

/** Form parsing for user-created foods (shared by create and edit). */
export interface UserFoodValues {
  name: string;
  brand: string | null;
  category: FoodCategory;
  barcode: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  serving_name: string | null;
  serving_grams: number | null;
}

/** Per-100 g facts for a user-created food; returns a status key (AUD-17) or values. */
export function parseUserFood(formData: FormData): { values: UserFoodValues } | { error: StatusKey } {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const brand = String(formData.get("brand") ?? "").trim().slice(0, 80) || null;
  const category = String(formData.get("category") ?? "") as FoodCategory;
  const barcodeRaw = String(formData.get("barcode") ?? "").trim();

  if (name.length < 2) return { error: "foodNameShort" };
  if (!FOOD_CATEGORIES.includes(category)) return { error: "foodCategory" };
  if (barcodeRaw && !/^\d{6,14}$/.test(barcodeRaw)) {
    return { error: "barcodeDigits" };
  }

  const num = (field: string, max: number) => {
    const n = Number(formData.get(field));
    return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 10) / 10 : null;
  };
  const kcal = num("kcal", 900);
  const protein = num("protein_g", 100);
  const carbs = num("carbs_g", 100);
  const fat = num("fat_g", 100);
  const fibre = num("fibre_g", 100);
  if (kcal == null) return { error: "kcalPer100Range" };
  if (protein == null || carbs == null || fat == null || fibre == null) {
    return { error: "macrosPer100Range" };
  }

  // Optional household serving (roadmap 2.2): both fields or neither.
  const servingName = String(formData.get("serving_name") ?? "").trim().slice(0, 60) || null;
  const servingGramsRaw = String(formData.get("serving_grams") ?? "").trim();
  let servingGrams: number | null = null;
  if (servingGramsRaw !== "") {
    const n = Number(servingGramsRaw);
    // Validate the value that will be stored: 0.04 g used to pass "> 0" and save as 0.
    servingGrams = Math.round(n * 10) / 10;
    if (!(servingGrams >= 1 && servingGrams <= 5000)) return { error: "servingWeightRange" };
  }
  if ((servingName == null) !== (servingGrams == null)) {
    return { error: "servingPair" };
  }

  return {
    values: {
      name,
      brand,
      category,
      barcode: barcodeRaw || null,
      kcal,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      fibre_g: fibre,
      serving_name: servingName,
      serving_grams: servingGrams,
    },
  };
}

/**
 * Admins add straight to the shared library. Everyone else gets a private
 * food they can log right away, submitted for admin review; approved, it
 * becomes shared with every user.
 */
