import type { StatusKey } from "@/i18n/status";

/** Form parsing for recipes (name, description, servings). */
export function parseRecipeFields(formData: FormData): { error: StatusKey } | {
  name: string;
  description: string | null;
  servings: number;
} {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const description = String(formData.get("description") ?? "").trim().slice(0, 500) || null;
  const servings = Number(formData.get("servings"));

  if (name.length < 2) return { error: "recipeNameShort" };
  // Validate the stored (rounded) value, as the message promises (0.5–100).
  const rounded = Math.round(servings * 10) / 10;
  if (!(rounded >= 0.5 && rounded <= 100)) return { error: "recipeServingsRange" };
  return { name, description, servings: rounded };
}
