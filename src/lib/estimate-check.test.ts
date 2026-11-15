import { describe, expect, it } from "vitest";
import { checkEstimate, densityFits, nameFits, queryWords, rankMatches } from "./estimate-check";
import type { Food } from "./types";

/** Real rows from the production catalogue (13 Nov 2026 review), trimmed to what matters. */
const food = (id: string, name: string, kcal: number, brand: string | null = null) =>
  ({ id, name, brand, kcal }) as unknown as Food;

const DRY_COUSCOUS = food("c1", "Couscous", 354);
const COOKED_COUSCOUS = food("c2", "Couscous, cooked", 112);
const HARIRA_MIX = food("h1", "Soupe marocaine Harira", 343);
const BEEF_STOCK = food("b1", "Bouillon arôme boeuf", 210);
const EGG = food("e1", "Egg, whole, cooked, hard-boiled", 155);
const LAIT = food("l1", "Lait", 45);
const LAIT_AMANDES = food("l2", "Lait amandes", 525);
const PIZZA_DOUGH = food("p1", "Masa pizza", 309);
const TEA = food("t1", "Thé", 0);

describe("rankMatches (food-data review F-1)", () => {
  it("a cooked couscous plate never defaults to dry semolina", () => {
    const r = rankMatches([DRY_COUSCOUS, COOKED_COUSCOUS], { kcal: 290, grams: 250 }, ["couscous cuit"]);
    expect(r.preselect).toBe("c2");
    expect(r.matches[0].id).toBe("c2");
  });

  it("only dry semolina available: keep the AI estimate", () => {
    expect(rankMatches([DRY_COUSCOUS], { kcal: 290, grams: 250 }, ["couscous"]).preselect).toBeNull();
  });

  it("a bowl of homemade harira doesn't become a packet of soup mix", () => {
    const r = rankMatches([HARIRA_MIX], { kcal: 230, grams: 300 }, ["harira"]);
    expect(r.preselect).toBeNull();
    expect(r.matches).toHaveLength(1); // still offered as an alternative
  });

  it("'oeuf' doesn't match 'boeuf'", () => {
    expect(rankMatches([BEEF_STOCK], { kcal: 155, grams: 100 }, ["oeuf"]).preselect).toBeNull();
    expect(nameFits(BEEF_STOCK, queryWords("oeuf"))).toBe(false);
  });

  it("good matches are still pre-selected", () => {
    expect(rankMatches([LAIT_AMANDES, LAIT], { kcal: 112, grams: 250 }, ["lait"]).preselect).toBe("l1");
    expect(rankMatches([EGG], { kcal: 78, grams: 50 }, ["egg"]).preselect).toBe("e1");
    expect(rankMatches([TEA], { kcal: 2, grams: 250 }, ["thé"]).preselect).toBe("t1");
  });

  it("the wrong product for 'pain' isn't pre-selected", () => {
    expect(rankMatches([PIZZA_DOUGH], { kcal: 220, grams: 80 }, ["pain"]).preselect).toBeNull();
  });

  it("falls back to the item name as a second query", () => {
    expect(rankMatches([COOKED_COUSCOUS], { kcal: 115, grams: 100 }, ["semoule", "Couscous"]).preselect).toBe("c2");
  });
});

describe("densityFits", () => {
  it("±30% band, absolute for near-zero foods", () => {
    expect(densityFits(130, 100)).toBe(true);
    expect(densityFits(131, 100)).toBe(false);
    expect(densityFits(77, 100)).toBe(true);
    expect(densityFits(76, 100)).toBe(false);
    expect(densityFits(0, 1)).toBe(true);
    expect(densityFits(42, 1)).toBe(false); // soda vs water
  });
});

describe("checkEstimate (F-4)", () => {
  it("recomputes kcal when it disagrees with the macros", () => {
    const r = checkEstimate({ kcal: 900, protein_g: 20, carbs_g: 60, fat_g: 10, fibre_g: 4 }, 300);
    expect(r.est.kcal).toBe(410);
    expect(r.flags).toEqual(["kcalFromMacros"]);
  });

  it("leaves consistent estimates alone", () => {
    const e = { kcal: 410, protein_g: 20, carbs_g: 60, fat_g: 10, fibre_g: 4 };
    expect(checkEstimate(e, 300)).toEqual({ est: e, flags: [] });
  });

  it("scales down anything denser than pure fat", () => {
    const r = checkEstimate({ kcal: 1000, protein_g: 0, carbs_g: 0, fat_g: 111, fibre_g: 0 }, 100);
    expect(r.est.kcal).toBe(900);
    expect(r.flags).toContain("tooDense");
  });

  it("drinks with almost no macros keep the model's kcal", () => {
    // 2 sugar cubes in atay: macros ~10 g carbs = 40 kcal
    expect(checkEstimate({ kcal: 40, protein_g: 0, carbs_g: 10, fat_g: 0, fibre_g: 0 }, 150).flags).toEqual([]);
  });
});
