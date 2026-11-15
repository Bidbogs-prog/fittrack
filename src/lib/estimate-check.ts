import type { Food } from "./types";

/**
 * Guards between the AI's meal estimate and the library (food-data review
 * F-1, F-3, F-4). Pure, so the rules are unit-tested with real cases from
 * the production catalogue.
 */

export type FoodState = "dry" | "cooked" | "prepared" | "drink" | "packaged";

export interface Estimate {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
}

/** 4/4/9: carbs here include fibre, as on most labels; good enough as a cross-check. */
export const atwater = (e: Pick<Estimate, "protein_g" | "carbs_g" | "fat_g">) => 4 * e.protein_g + 4 * e.carbs_g + 9 * e.fat_g;

export type EstimateFlag = "kcalFromMacros" | "tooDense";

/**
 * Make an estimate internally consistent. Models are better at macros than
 * at adding them up, so when kcal disagrees with 4P+4C+9F by more than 20%
 * (and the macros carry real energy) kcal is recomputed. Nothing edible is
 * denser than fat (~9 kcal/g): above that, everything is scaled down.
 */
export function checkEstimate(est: Estimate, grams: number): { est: Estimate; flags: EstimateFlag[] } {
  const flags: EstimateFlag[] = [];
  let e = { ...est };
  const fromMacros = atwater(e);
  if (fromMacros >= 20 && Math.abs(e.kcal - fromMacros) / Math.max(e.kcal, fromMacros) > 0.2) {
    e.kcal = Math.round(fromMacros);
    flags.push("kcalFromMacros");
  }
  if (grams > 0 && e.kcal / grams > 9.2) {
    const k = (9 * grams) / e.kcal;
    e = {
      kcal: Math.round(e.kcal * k),
      protein_g: round1(e.protein_g * k),
      carbs_g: round1(e.carbs_g * k),
      fat_g: round1(e.fat_g * k),
      fibre_g: round1(e.fibre_g * k),
    };
    flags.push("tooDense");
  }
  return { est: e, flags };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Lowercase, no accents, letters/digits/Arabic only: "Thé à la menthe" → "the a la menthe". */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim();
}

const STOP = new Set(["de", "du", "des", "la", "le", "les", "a", "au", "aux", "et", "with", "and", "of", "en", "cuit", "cooked", "raw", "cru"]);

/** Meaningful whole words of a query (≥ 3 letters, not filler). */
export function queryWords(q: string): string[] {
  return normalize(q)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

/** Every meaningful query word appears as a whole word in the food's name or brand ("oeuf" ≠ "boeuf"). */
export function nameFits(food: Pick<Food, "name" | "brand">, words: string[]): boolean {
  if (words.length === 0) return false;
  const hay = ` ${normalize(`${food.name} ${food.brand ?? ""}`)} `;
  return words.every((w) => hay.includes(` ${w} `) || hay.includes(` ${w}s `));
}

/**
 * Energy density agrees: within ±30% of the estimate per 100 g, or both
 * near zero (water, tea, coffee, diet drinks). This is what tells dry
 * couscous (354 kcal/100 g) from a cooked plate (~115), and a harira
 * packet (343) from a bowl (~75).
 */
export function densityFits(foodKcalPer100: number, estKcalPer100: number): boolean {
  if (estKcalPer100 < 15 || foodKcalPer100 < 15) return Math.abs(foodKcalPer100 - estKcalPer100) <= 15;
  const r = foodKcalPer100 / estKcalPer100;
  return r >= 1 / 1.3 && r <= 1.3;
}

/**
 * Order library candidates for an estimated item and decide which (if any)
 * to pre-select. A match is pre-selected only when its name fits the query
 * on whole words AND its energy density agrees with the estimate; otherwise
 * the AI estimate stays selected and matches are offered as alternatives,
 * closest density first.
 */
export function rankMatches(
  matches: Food[],
  est: { kcal: number; grams: number },
  queries: string[]
): { matches: Food[]; preselect: string | null } {
  const estPer100 = est.grams > 0 ? (est.kcal / est.grams) * 100 : 0;
  const wordSets = queries.map(queryWords).filter((w) => w.length > 0);
  const fits = (f: Food) => wordSets.some((w) => nameFits(f, w)) && densityFits(Number(f.kcal), estPer100);
  const distance = (f: Food) => Math.abs(Math.log((Number(f.kcal) + 10) / (estPer100 + 10)));
  const unique = [...new Map(matches.map((f) => [f.id, f])).values()];
  const sorted = unique.sort((a, b) => Number(fits(b)) - Number(fits(a)) || distance(a) - distance(b));
  const best = sorted.find(fits);
  return { matches: sorted, preselect: best ? best.id : null };
}
