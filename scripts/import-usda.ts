/**
 * Seed `public.foods` with generic staples from USDA SR Legacy (FoodData
 * Central bulk CSV) — the foods people cook with that Open Food Facts'
 * barcode-centric data misses: fresh produce, raw/cooked meat and fish,
 * grains, legumes. Curated via the rules below (not a bulk dump), with the
 * full 21-column micronutrient panel.
 *
 * Usage:
 *   node scripts/import-usda.ts --dry-run   # parse + curate + report, no DB writes
 *   node scripts/import-usda.ts             # import (needs SUPABASE_SECRET_KEY in .env.local)
 *
 * The dataset (~6 MB zip) is cached in .usda-cache/. USDA data is public
 * domain (CC0) — no attribution required. Rows carry source = 'usda' and no
 * barcode; idempotency comes from the partial unique index on (name) where
 * source = 'usda' (re-runs skip existing names, admin edits survive).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ZIP_URL =
  "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip";
const CACHE_DIR = path.join(process.cwd(), ".usda-cache");
const DATA_DIR = path.join(CACHE_DIR, "FoodData_Central_sr_legacy_food_csv_2018-04");
const DRY_RUN = process.argv.includes("--dry-run");

type Category =
  | "protein"
  | "carbs"
  | "dairy"
  | "fruit"
  | "vegetables"
  | "fats-nuts"
  | "snacks"
  | "drinks"
  | "other";

interface FoodInsert {
  name: string;
  brand: null;
  category: Category;
  barcode: null;
  source: "usda";
  image_url: null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  [micro: string]: string | number | null;
}

/** nutrient_nbr → foods column, with the unit the column expects. */
const NUTRIENTS: Array<{ col: string; nbr: string; unit: "KCAL" | "G" | "MG" | "UG" }> = [
  { col: "kcal", nbr: "208", unit: "KCAL" },
  { col: "protein_g", nbr: "203", unit: "G" },
  { col: "fat_g", nbr: "204", unit: "G" },
  { col: "carbs_g", nbr: "205", unit: "G" },
  { col: "fibre_g", nbr: "291", unit: "G" },
  { col: "saturated_fat_g", nbr: "606", unit: "G" },
  { col: "trans_fat_g", nbr: "605", unit: "G" },
  { col: "sugar_g", nbr: "269", unit: "G" },
  { col: "cholesterol_mg", nbr: "601", unit: "MG" },
  { col: "sodium_mg", nbr: "307", unit: "MG" },
  { col: "potassium_mg", nbr: "306", unit: "MG" },
  { col: "calcium_mg", nbr: "301", unit: "MG" },
  { col: "iron_mg", nbr: "303", unit: "MG" },
  { col: "magnesium_mg", nbr: "304", unit: "MG" },
  { col: "zinc_mg", nbr: "309", unit: "MG" },
  { col: "vitamin_a_ug", nbr: "320", unit: "UG" },
  { col: "vitamin_c_mg", nbr: "401", unit: "MG" },
  { col: "vitamin_d_ug", nbr: "328", unit: "UG" },
  { col: "vitamin_e_mg", nbr: "323", unit: "MG" },
  { col: "vitamin_k_ug", nbr: "430", unit: "UG" },
  { col: "thiamin_mg", nbr: "404", unit: "MG" },
  { col: "riboflavin_mg", nbr: "405", unit: "MG" },
  { col: "niacin_mg", nbr: "406", unit: "MG" },
  { col: "vitamin_b6_mg", nbr: "415", unit: "MG" },
  { col: "folate_ug", nbr: "417", unit: "UG" },
  { col: "vitamin_b12_ug", nbr: "418", unit: "UG" },
];

const UNIT_FACTOR: Record<string, Record<string, number>> = {
  KCAL: { KCAL: 1 },
  G: { G: 1, MG: 1e-3, UG: 1e-6 },
  MG: { G: 1e3, MG: 1, UG: 1e-3 },
  UG: { G: 1e6, MG: 1e3, UG: 1 },
};

/**
 * Curation: which SR Legacy foods make the cut, per USDA category.
 * Descriptions are matched case-insensitively. The goal is basic raw/cooked
 * forms of staples common in Morocco — not six variants of everything.
 */
const PLAIN = "cooked, boiled, drained, without salt";
const RULES: Array<{ usdaCat: string; ourCat: Category; include: RegExp; exclude?: RegExp }> = [
  // Eggs live in USDA's dairy category but are protein in ours.
  {
    usdaCat: "Dairy and Egg Products",
    ourCat: "protein",
    include: /^Egg, (whole, raw, fresh|whole, cooked, (hard-boiled|fried|omelet|poached)|yolk, raw, fresh|white, raw, fresh)$/i,
  },
  {
    usdaCat: "Dairy and Egg Products",
    ourCat: "dairy",
    include: /^(Milk, whole, 3\.25% milkfat, with added vitamin D|Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D|Milk, lowfat, fluid, 1% milkfat, with added vitamin A and vitamin D|Milk, nonfat, fluid, with added vitamin A and vitamin D \(fat free or skim\)|Yogurt, (plain|Greek, plain)|Cheese, (cheddar|mozzarella|feta|goat|ricotta|parmesan|cream|gouda|edam|swiss|blue)|Butter, (salted|without salt)|Cream, fluid, heavy whipping)/i,
    exclude: /low sodium|nonfat or fat free|reduced fat|low moisture|sharp, sliced|parmesan, grated|goat, (hard|semisoft)|pasteurized process|shredded/i,
  },
  {
    usdaCat: "Spices and Herbs",
    ourCat: "other",
    include: /^(Spices, (anise seed|basil, dried|bay leaf|caraway seed|cinnamon, ground|cloves, ground|coriander (leaf, dried|seed)|cumin seed|curry powder|fenugreek seed|garlic powder|ginger, ground|onion powder|oregano, dried|paprika|parsley, dried|pepper, black|pepper, red or cayenne|saffron|turmeric, ground)|(Basil|Dill weed|Peppermint|Rosemary|Spearmint|Thyme), fresh|Vinegar, (cider|red wine))$/i,
  },
  {
    usdaCat: "Fats and Oils",
    ourCat: "fats-nuts",
    include: /^Oil, (olive, salad or cooking|sunflower, linoleic \(less than 60%\)|soybean, salad or cooking|canola|sesame, salad or cooking|peanut, salad or cooking)/i,
    exclude: /industrial|partially hydrogenated| and |, and /i,
  },
  {
    usdaCat: "Poultry Products",
    ourCat: "protein",
    include: /^(Chicken, broilers or fryers, (breast, meat only, (raw|cooked, roasted)|thigh, meat (only, cooked, (roasted|stewed)|and skin, raw)|drumstick, meat (only, cooked, stewed|and skin, raw)|wing, meat only, cooked, roasted|meat only, (raw|cooked, roasted))|Chicken, liver, all classes, (raw|cooked, simmered)|Turkey, retail parts, breast, meat only, (raw|cooked, roasted)|Turkey, ground, 93% lean)/i,
    exclude: /with added solution/i,
  },
  {
    usdaCat: "Fruits and Fruit Juices",
    ourCat: "fruit",
    include: /^(Apples, raw, with skin|Apricots, raw|Apricots, dried, sulfured, uncooked|Bananas, raw|Blackberries, raw|Blueberries, raw|Cherries, sweet, raw|Clementines, raw|Dates, deglet noor|Dates, medjool|Figs, raw|Figs, dried, uncooked|Grapefruit, raw, pink and red|Grapes, red or green.*, raw|Kiwifruit, green, raw|Lemons, raw, without peel|Limes, raw|Mangos, raw|Melons, cantaloupe, raw|Melons, honeydew, raw|Nectarines, raw|Oranges, raw, all commercial varieties|Papayas, raw|Peaches, raw|Pears, raw|Pineapple, raw, all varieties|Plums, raw|Plums, dried \(prunes\), uncooked|Pomegranates, raw|Quinces, raw|Raisins, seedless|Raspberries, raw|Strawberries, raw|Tangerines, \(mandarin oranges\), raw|Watermelon, raw)$/i,
  },
  {
    usdaCat: "Vegetables and Vegetable Products",
    ourCat: "vegetables",
    include: new RegExp(
      "^(" +
        [
          "Artichokes, \\(globe or french\\), raw",
          `Artichokes, \\(globe or french\\), ${PLAIN}`,
          "Arugula, raw",
          "Asparagus, raw",
          `Asparagus, ${PLAIN}`,
          "Beets, raw",
          `Beets, ${PLAIN}`,
          "Broccoli, " + PLAIN,
          "Cabbage, raw",
          `Cabbage, ${PLAIN}`,
          "Carrots, raw",
          `Carrots, ${PLAIN}`,
          "Cauliflower, raw",
          `Cauliflower, ${PLAIN}`,
          "Celery, raw",
          "Chard, swiss, raw",
          `Chard, swiss, ${PLAIN}`,
          "Corn, sweet, yellow, raw",
          "Coriander \\(cilantro\\) leaves, raw",
          "Cucumber, with peel, raw",
          "Eggplant, raw",
          `Eggplant, ${PLAIN}`,
          "Garlic, raw",
          "Kale, raw",
          "Leeks, \\(bulb and lower leaf-portion\\), raw",
          "Lettuce, cos or romaine, raw",
          "Lettuce, iceberg \\(includes crisphead types\\), raw",
          "Mushrooms, white, raw",
          "Okra, raw",
          `Okra, ${PLAIN}`,
          "Onions, raw",
          "Parsley, fresh",
          "Peas, green, raw",
          `Peas, green, ${PLAIN}`,
          "Peppers, sweet, green, raw",
          "Peppers, sweet, red, raw",
          "Peppers, hot chili, green, raw",
          "Peppers, hot chili, red, raw",
          "Potatoes, flesh and skin, raw",
          "Potatoes, boiled, cooked without skin, flesh, without salt",
          "Potatoes, baked, flesh, without salt",
          "Pumpkin, raw",
          `Pumpkin, ${PLAIN}`,
          "Radishes, raw",
          `Spinach, ${PLAIN}`,
          "Squash, summer, zucchini, includes skin, raw",
          `Squash, summer, zucchini, includes skin, ${PLAIN}`,
          "Sweet potato, cooked, baked in skin, flesh, without salt",
          "Tomatoes, red, ripe, raw, year round average",
          "Tomato products, canned, paste, without salt added",
          "Tomato products, canned, puree, without salt added",
          "Tomato products, canned, sauce",
          "Turnips, raw",
          `Turnips, ${PLAIN}`,
        ].join("|") +
        ")$",
      "i"
    ),
  },
  {
    usdaCat: "Legumes and Legume Products",
    ourCat: "vegetables",
    include: /^(Chickpeas \(garbanzo beans, bengal gram\), mature seeds, (raw|cooked, boiled, without salt)|Lentils, mature seeds, (raw|cooked, boiled, without salt)|Broadbeans \(fava beans\), mature seeds, (raw|cooked, boiled, without salt)|Beans, white, mature seeds, (raw|cooked, boiled, without salt)|Beans, kidney, all types, mature seeds, (raw|cooked, boiled, without salt)|Beans, black, mature seeds, cooked, boiled, without salt|Peas, split, mature seeds, (raw|cooked, boiled, without salt)|Hummus, commercial)$/i,
  },
  {
    usdaCat: "Legumes and Legume Products",
    ourCat: "fats-nuts",
    include: /^(Peanuts, all types, (raw|dry-roasted, without salt))$/i,
  },
  {
    usdaCat: "Nut and Seed Products",
    ourCat: "fats-nuts",
    include: /^(Nuts, walnuts, english|Nuts, cashew nuts, (raw|dry roasted, without salt)|Nuts, pistachio nuts, (raw|dry roasted, without salt)|Nuts, hazelnuts or filberts|Nuts, pine nuts, dried|Seeds, sesame seeds, whole, dried|Seeds, sesame butter, tahini, from roasted and toasted kernels|Seeds, sunflower seed kernels, dried|Seeds, pumpkin and squash seed kernels, (dried|roasted, without salt)|Seeds, flaxseed|Seeds, chia seeds, dried)$/i,
  },
  {
    usdaCat: "Fruits and Fruit Juices",
    ourCat: "fats-nuts",
    include: /^(Olives, ripe, canned \(small-extra large\)|Olives, pickled, canned or bottled, green)$/i,
  },
  {
    usdaCat: "Beef Products",
    ourCat: "protein",
    include: /^(Beef, ground, (85|90|95)% lean meat \/ (15|10|5)% fat, (raw|patty, cooked, pan-broiled)|Beef, (tenderloin|top sirloin|round, top round|chuck, arm pot roast|brisket, whole).*separable lean only.*(raw|cooked, (broiled|braised|roasted))|Beef, variety meats and by-products, liver, (raw|cooked, braised))$/i,
    exclude: /select|choice|wagyu|grass-fed|australian|new zealand/i,
  },
  {
    usdaCat: "Lamb, Veal, and Game Products",
    ourCat: "protein",
    include: /^(Lamb, ground, (raw|cooked, broiled)|Lamb, (leg, whole \(shank and sirloin\)|shoulder, whole \(arm and blade\)|loin|cubed for stew or kabob \(leg and shoulder\)), separable lean only, trimmed to 1\/4" fat(, choice)?, (raw|cooked, (roasted|braised|broiled))|Lamb, variety meats and by-products, liver, (raw|cooked, braised))$/i,
    exclude: /new zealand|australian/i,
  },
  {
    usdaCat: "Finfish and Shellfish Products",
    ourCat: "protein",
    include: /^(Fish, (sardine, Atlantic, canned in oil, drained solids with bone|anchovy, european, (raw|canned in oil, drained solids)|mackerel, Atlantic, (raw|cooked, dry heat)|tuna, fresh, yellowfin, (raw|cooked, dry heat)|tuna, light, canned in oil, drained solids|tuna, light, canned in water, drained solids \(Includes foods for USDA's Food Distribution Program\)|salmon, Atlantic, farmed, cooked, dry heat|cod, Atlantic, (raw|cooked, dry heat)|sea bass, mixed species, (raw|cooked, dry heat)|whiting, mixed species, (raw|cooked, dry heat)|flatfish \(flounder and sole species\), (raw|cooked, dry heat)|swordfish, (raw|cooked, dry heat)|tilapia, (raw|cooked, dry heat)|trout, rainbow, farmed, (raw|cooked, dry heat))|Crustaceans, shrimp, (raw|cooked)|Mollusks, (mussel, blue, (raw|cooked, moist heat)|octopus, common, (raw|cooked, moist heat)|squid, mixed species, raw))$/i,
  },
  {
    usdaCat: "Cereal Grains and Pasta",
    ourCat: "carbs",
    include: /^(Rice, white, long-grain, regular, raw, unenriched|Rice, brown, long-grain, cooked \(Includes foods for USDA's Food Distribution Program\)|Couscous, (dry|cooked)|Bulgur, (dry|cooked)|Barley, pearled, (raw|cooked)|Cornmeal, whole-grain, yellow|Semolina, unenriched|Wheat flour, white, all-purpose, unenriched|Wheat flour, whole-grain|Pasta, dry, unenriched|Noodles, egg, cooked, unenriched|Quinoa, (uncooked|cooked))$/i,
  },
  {
    usdaCat: "Baked Products",
    ourCat: "carbs",
    include: /^(Bread, white, commercially prepared \(includes soft bread crumbs\)|Bread, pita, white, unenriched|Bread, pita, whole-wheat|Bread, french or vienna \(includes sourdough\)|Bread, rye|Croissants, butter|Bread, naan, plain, commercially prepared)$/i,
    exclude: /toasted/i,
  },
  {
    usdaCat: "Sweets",
    ourCat: "other",
    include: /^(Honey|Sugars, granulated|Jams and preserves|Molasses)$/i,
  },
  {
    usdaCat: "Beverages",
    ourCat: "drinks",
    include: /^(Beverages, tea, black, brewed, prepared with tap water|Beverages, tea, green, brewed, regular|Beverages, coffee, brewed, prepared with tap water|Beverages, coffee, brewed, espresso, restaurant-prepared)$/i,
    exclude: /decaf/i,
  },
];

/** Concept-duplicates of the 22 hand-seeded starters — skip to avoid noise. */
const SEED_DUPLICATES =
  /^(Chicken, broilers or fryers, breast, meat only, raw|Egg, whole, raw, fresh|Beef, ground, 95% lean meat \/ 5% fat, raw|Milk, reduced fat, fluid, 2%|Yogurt, Greek, plain, whole milk|Bananas, raw|Blueberries, raw|Apples, raw, with skin|Avocados, raw, all commercial varieties|Nuts, almonds|Oil, olive, salad or cooking$)/i;

/** SR taxonomy noise → shorter, still-truthful display names. */
const NAME_CLEANUPS: Array<[RegExp, string]> = [
  [/^Nuts, /i, ""],
  [/^Seeds, /i, ""],
  [/^Fish, /i, ""],
  [/^Crustaceans, /i, ""],
  [/^Mollusks, /i, ""],
  [/^Spices, /i, ""],
  [/^Beverages, /i, ""],
  [/ \(Includes foods for USDA's Food Distribution Program\)/i, ""],
  [/ \(may contain additives to retain moisture\)/i, ""],
  [/, broilers or fryers/i, ""],
  [/, all classes/i, ""],
  [/, retail parts/i, ""],
  [/, mature seeds/i, ""],
  [/, mixed species/i, ""],
  [/ \(includes crisphead types\)/i, ""],
  [/ \(includes sourdough\)/i, ""],
  [/ \(includes soft bread crumbs\)/i, ""],
  [/ \(European type, such as Thompson seedless\)/i, ""],
  [/ \(fat free or skim\)/i, ""],
  [/ \(bulb and lower leaf-portion\)/i, ""],
  [/ \(globe or french\)/i, ""],
  [/ \(garbanzo beans, bengal gram\)/i, ""],
  [/ \(small-extra large\)/i, ""],
  [/, variety meats and by-products/i, ""],
  [/, separable lean only, trimmed to 1\/[48]" fat/i, ", lean only"],
  [/, separable lean only/i, ", lean only"],
  [/, all grades/i, ""],
  [/, choice/i, ""],
  [/, with added vitamin A and vitamin D/i, ""],
  [/, with added vitamin D/i, ""],
  [/, fluid(?=,)/i, ""],
  [/, cooked, boiled, drained, without salt/i, ", boiled"],
  [/, cooked, boiled, without salt/i, ", boiled"],
  [/, without salt added/i, ""],
  [/, without added salt/i, ""],
  [/, without salt/i, ""],
  [/, commercially prepared/i, ""],
  [/, year round average/i, ""],
  [/, prepared with tap water/i, ""],
  [/, brewed, regular$/i, ", brewed"],
  [/, unenriched/i, ""],
  [/, sulfured, uncooked/i, ""],
  [/, uncooked$/i, ""],
  [/, raw, fresh$/i, ", raw"],
  [/\s+/g, " "],
];

function cleanName(description: string): string {
  let name = description;
  for (const [pattern, replacement] of NAME_CLEANUPS) name = name.replace(pattern, replacement);
  name = name
    .replace(/,\s*,/g, ",")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*$/, "")
    .trim();
  return (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 150);
}

/** Minimal RFC-4180 CSV parser (quoted fields, embedded commas/quotes/newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function loadTable(file: string): { header: Record<string, number>; rows: string[][] } {
  const rows = parseCsv(readFileSync(path.join(DATA_DIR, file), "utf8"));
  const header: Record<string, number> = {};
  rows[0].forEach((h, i) => (header[h] = i));
  return { header, rows: rows.slice(1) };
}

function ensureDataset(): void {
  if (existsSync(DATA_DIR)) return;
  mkdirSync(CACHE_DIR, { recursive: true });
  const zip = path.join(CACHE_DIR, "sr_legacy.zip");
  if (!existsSync(zip)) {
    console.log(`Downloading ${ZIP_URL}...`);
    execFileSync("curl", ["-s", "-o", zip, ZIP_URL]);
  }
  // Windows 10+ and macOS/Linux all ship a tar that reads zip archives.
  execFileSync("tar", ["-xf", zip, "-C", CACHE_DIR]);
}

function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  ensureDataset();

  const categories = loadTable("food_category.csv");
  const catById = new Map<string, string>();
  for (const r of categories.rows)
    catById.set(r[categories.header.id], r[categories.header.description]);

  const nutrients = loadTable("nutrient.csv");
  const nbrByNutrientId = new Map<string, string>();
  const unitByNutrientId = new Map<string, string>();
  for (const r of nutrients.rows) {
    const id = r[nutrients.header.id];
    // nutrient_nbr comes as e.g. "203" or "203.0"
    nbrByNutrientId.set(id, r[nutrients.header.nutrient_nbr].replace(/\.0$/, ""));
    unitByNutrientId.set(id, r[nutrients.header.unit_name].toUpperCase());
  }
  const wantedNbrs = new Map(NUTRIENTS.map((n) => [n.nbr, n]));

  // Select foods.
  const food = loadTable("food.csv");
  const picked = new Map<string, { description: string; ourCat: Category }>();
  for (const r of food.rows) {
    if (r[food.header.data_type] !== "sr_legacy_food") continue;
    const description = r[food.header.description];
    const usdaCat = catById.get(r[food.header.food_category_id]) ?? "";
    if (SEED_DUPLICATES.test(description)) continue;
    for (const rule of RULES) {
      if (rule.usdaCat !== usdaCat) continue;
      if (!rule.include.test(description)) continue;
      if (rule.exclude?.test(description)) continue;
      picked.set(r[food.header.fdc_id], { description, ourCat: rule.ourCat });
      break;
    }
  }

  // Collect nutrient amounts for picked foods, normalised to column units.
  const amounts = new Map<string, Record<string, number>>();
  const fn = loadTable("food_nutrient.csv");
  for (const r of fn.rows) {
    const fdcId = r[fn.header.fdc_id];
    if (!picked.has(fdcId)) continue;
    const nutrientId = r[fn.header.nutrient_id];
    const nbr = nbrByNutrientId.get(nutrientId);
    const spec = nbr ? wantedNbrs.get(nbr) : undefined;
    if (!spec) continue;
    const raw = Number(r[fn.header.amount]);
    if (!Number.isFinite(raw) || raw < 0) continue;
    const factor = UNIT_FACTOR[spec.unit]?.[unitByNutrientId.get(nutrientId) ?? ""];
    if (factor === undefined) continue;
    const bag = amounts.get(fdcId) ?? {};
    bag[spec.col] = raw * factor;
    amounts.set(fdcId, bag);
  }

  // Assemble rows (dedup by cleaned name — e.g. two SR grades of one cut).
  const rows: FoodInsert[] = [];
  const seenNames = new Set<string>();
  const rejects: string[] = [];
  const categoryCounts: Record<string, number> = {};
  let microCells = 0;
  const MICRO_COLS = NUTRIENTS.map((n) => n.col).filter(
    (c) => !["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"].includes(c)
  );
  for (const [fdcId, { description, ourCat }] of picked) {
    const bag = amounts.get(fdcId) ?? {};
    if (
      bag.kcal === undefined ||
      bag.protein_g === undefined ||
      bag.carbs_g === undefined ||
      bag.fat_g === undefined
    ) {
      rejects.push(description);
      continue;
    }
    const name = cleanName(description);
    if (seenNames.has(name.toLowerCase())) continue;
    seenNames.add(name.toLowerCase());
    const row: FoodInsert = {
      name,
      brand: null,
      category: ourCat,
      barcode: null,
      source: "usda",
      image_url: null,
      kcal: round1(bag.kcal),
      protein_g: round1(bag.protein_g),
      carbs_g: round1(bag.carbs_g),
      fat_g: round1(bag.fat_g),
      fibre_g: round1(bag.fibre_g ?? 0),
    };
    for (const col of MICRO_COLS) {
      const v = bag[col];
      row[col] = v !== undefined && v <= 99999 ? round2(v) : null;
      if (row[col] !== null) microCells++;
    }
    categoryCounts[ourCat] = (categoryCounts[ourCat] ?? 0) + 1;
    rows.push(row);
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Picked ${picked.size} foods; ${rows.length} with complete macros.`);
  if (rejects.length) console.log(`Rejected (missing macros): ${rejects.join("; ")}`);
  console.log("Categories:", categoryCounts);
  console.log(
    `Micro panel fill: ${((microCells / Math.max(1, rows.length * MICRO_COLS.length)) * 100).toFixed(0)}%`
  );

  if (DRY_RUN) {
    writeFileSync(path.join(CACHE_DIR, "usda-foods.json"), JSON.stringify(rows, null, 2));
    const md = [
      "# Proposed USDA staples import",
      "",
      `${rows.length} foods. Review, then run \`node scripts/import-usda.ts\` to load.`,
      "",
      "| Food | Category | kcal/100g | Protein | Carbs | Fat |",
      "|---|---|---|---|---|---|",
      ...rows.map(
        (r) => `| ${r.name} | ${r.category} | ${r.kcal} | ${r.protein_g} | ${r.carbs_g} | ${r.fat_g} |`
      ),
    ].join("\n");
    writeFileSync(path.join(CACHE_DIR, "usda-food-list.md"), md);
    console.log(`\nDry run: no database writes.`);
    console.log(`Full list: .usda-cache/usda-food-list.md`);
    console.log(`Mapped data: .usda-cache/usda-foods.json`);
    return;
  }

  const env = loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Set SUPABASE_SECRET_KEY (sb_secret_..., from Dashboard → Settings → API keys) in .env.local, or run with --dry-run."
    );
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // No barcode on generic foods — idempotency by name within source='usda'.
  const { data: existing, error: readError } = await supabase
    .from("foods")
    .select("name")
    .eq("source", "usda");
  if (readError) throw new Error(`Could not read existing foods: ${readError.message}`);
  const existingNames = new Set((existing ?? []).map((r) => (r.name as string).toLowerCase()));
  const fresh = rows.filter((r) => !existingNames.has(r.name.toLowerCase()));
  console.log(`${rows.length - fresh.length} already present; inserting ${fresh.length}.`);

  for (let i = 0; i < fresh.length; i += 500) {
    const batch = fresh.slice(i, i + 500);
    const { error } = await supabase.from("foods").insert(batch);
    if (error) throw new Error(`Insert failed: ${error.message}`);
  }
  console.log(`Done. ${fresh.length} USDA foods inserted.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
