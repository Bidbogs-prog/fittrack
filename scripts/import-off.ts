/**
 * Seed `public.foods` from the Open Food Facts CSV export, filtered to
 * products sold in Morocco (`countries_tags` contains `en:morocco`).
 *
 * Usage:
 *   node scripts/import-off.ts --dry-run   # download + parse + report, no DB writes
 *   node scripts/import-off.ts             # import (needs SUPABASE_SECRET_KEY in .env.local)
 *
 * The ~1 GB gzipped CSV is cached in .off-cache/ so re-runs skip the download
 * (delete the file to fetch a fresh export). All facts land per 100 g,
 * matching the foods table. Re-runs never overwrite: existing barcodes are
 * skipped (ON CONFLICT DO NOTHING), so admin edits to imported rows survive.
 *
 * Data is © Open Food Facts contributors, licensed under the ODbL —
 * attribution required in the app for imported rows (source = 'off').
 */
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const CSV_URL = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz";
const CACHE_DIR = path.join(process.cwd(), ".off-cache");
const CSV_PATH = path.join(CACHE_DIR, "off-products.csv.gz");
const COUNTRY_TAG = "en:morocco";
const BATCH_SIZE = 500;
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
  brand: string | null;
  category: Category;
  barcode: string;
  source: "off";
  image_url: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  [micro: string]: string | number | null;
}

/** First matching rule wins; order resolves products with several tags
 * (milk is both en:beverages and en:dairies → dairy). */
const CATEGORY_RULES: Array<[Category, string[]]> = [
  ["dairy", ["en:dairies", "en:milks", "en:cheeses", "en:yogurts", "en:fermented-milk-products", "en:dairy-desserts", "en:creams", "en:butters"]],
  ["fats-nuts", ["en:fats", "en:oils", "en:vegetable-oils", "en:olive-oils", "en:nuts", "en:seeds", "en:nut-butters", "en:peanut-butters", "en:margarines", "en:olives"]],
  ["protein", ["en:meats", "en:poultry", "en:seafood", "en:fishes", "en:canned-fishes", "en:eggs", "en:charcuteries", "en:sausages", "en:meals-with-meat", "en:protein-powders"]],
  ["fruit", ["en:fruits", "en:dried-fruits", "en:dates", "en:compotes", "en:fruits-based-foods"]],
  ["vegetables", ["en:vegetables", "en:canned-vegetables", "en:legumes", "en:pickles", "en:tomatoes", "en:salads"]],
  ["drinks", ["en:beverages", "en:waters", "en:sodas", "en:juices", "en:fruit-juices", "en:teas", "en:coffees", "en:plant-based-beverages", "en:carbonated-drinks", "en:syrups"]],
  ["snacks", ["en:snacks", "en:sweet-snacks", "en:salty-snacks", "en:biscuits", "en:chocolates", "en:candies", "en:confectioneries", "en:desserts", "en:ice-creams", "en:cakes", "en:pastries", "en:viennoiseries", "en:chips-and-fries", "en:crisps", "en:sweet-spreads"]],
  ["carbs", ["en:breads", "en:cereals-and-potatoes", "en:cereals-and-their-products", "en:pastas", "en:rices", "en:couscous", "en:semolinas", "en:flours", "en:breakfast-cereals", "en:potatoes", "en:grains"]],
];

/** CSV *_100g values are normalised to grams; convert to the column's unit
 * and null out values beyond real-world plausibility (crowdsourced typos). */
const MICRO_MAP: Array<{ col: string; csv: string; factor: number; cap: number }> = [
  { col: "saturated_fat_g", csv: "saturated-fat_100g", factor: 1, cap: 100 },
  { col: "trans_fat_g", csv: "trans-fat_100g", factor: 1, cap: 50 },
  { col: "sugar_g", csv: "sugars_100g", factor: 1, cap: 100 },
  { col: "cholesterol_mg", csv: "cholesterol_100g", factor: 1e3, cap: 3000 },
  { col: "sodium_mg", csv: "sodium_100g", factor: 1e3, cap: 40000 },
  { col: "potassium_mg", csv: "potassium_100g", factor: 1e3, cap: 20000 },
  { col: "calcium_mg", csv: "calcium_100g", factor: 1e3, cap: 15000 },
  { col: "iron_mg", csv: "iron_100g", factor: 1e3, cap: 200 },
  { col: "magnesium_mg", csv: "magnesium_100g", factor: 1e3, cap: 5000 },
  { col: "zinc_mg", csv: "zinc_100g", factor: 1e3, cap: 200 },
  { col: "vitamin_a_ug", csv: "vitamin-a_100g", factor: 1e6, cap: 30000 },
  { col: "vitamin_c_mg", csv: "vitamin-c_100g", factor: 1e3, cap: 2000 },
  { col: "vitamin_d_ug", csv: "vitamin-d_100g", factor: 1e6, cap: 500 },
  { col: "vitamin_e_mg", csv: "vitamin-e_100g", factor: 1e3, cap: 300 },
  { col: "vitamin_k_ug", csv: "vitamin-k_100g", factor: 1e6, cap: 2000 },
  { col: "thiamin_mg", csv: "vitamin-b1_100g", factor: 1e3, cap: 100 },
  { col: "riboflavin_mg", csv: "vitamin-b2_100g", factor: 1e3, cap: 100 },
  { col: "niacin_mg", csv: "vitamin-pp_100g", factor: 1e3, cap: 500 },
  { col: "vitamin_b6_mg", csv: "vitamin-b6_100g", factor: 1e3, cap: 100 },
  { col: "folate_ug", csv: "vitamin-b9_100g", factor: 1e6, cap: 5000 },
  { col: "vitamin_b12_ug", csv: "vitamin-b12_100g", factor: 1e6, cap: 500 },
];

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

async function download(): Promise<void> {
  if (existsSync(CSV_PATH)) {
    console.log(`Using cached export: ${CSV_PATH} (delete it to re-download)`);
    return;
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`Downloading ${CSV_URL} (~1 GB, one-off)...`);
  const res = await fetch(CSV_URL);
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
  const tmp = `${CSV_PATH}.part`;
  let bytes = 0;
  let lastLogged = 0;
  const body = Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream);
  body.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes - lastLogged > 100 * 1024 * 1024) {
      lastLogged = bytes;
      console.log(`  ${(bytes / 1e6).toFixed(0)} MB...`);
    }
  });
  await pipeline(body, createWriteStream(tmp));
  renameSync(tmp, CSV_PATH);
  console.log(`Downloaded ${(bytes / 1e6).toFixed(0)} MB.`);
}

function num(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function pickCategory(categoriesTags: string): Category {
  const tags = categoriesTags.split(",").map((t) => t.trim());
  for (const [category, matches] of CATEGORY_RULES) {
    if (matches.some((m) => tags.includes(m))) return category;
  }
  return "other";
}

async function main() {
  await download();

  const rl = createInterface({
    input: createReadStream(CSV_PATH).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  let header: string[] | null = null;
  const idx: Record<string, number> = {};
  const col = (row: string[], name: string): string | undefined => row[idx[name]];

  const rejects: Record<string, number> = {};
  const reject = (reason: string) => {
    rejects[reason] = (rejects[reason] ?? 0) + 1;
  };

  const seen = new Set<string>();
  const rows: FoodInsert[] = [];
  const categoryCounts: Record<string, number> = {};
  const microCoverage: Record<string, number> = {};
  let scanned = 0;
  let inMorocco = 0;

  for await (const line of rl) {
    if (!header) {
      header = line.split("\t");
      header.forEach((h, i) => (idx[h] = i));
      const required = [
        "code", "product_name", "countries_tags", "categories_tags", "brands",
        "image_url", "energy-kcal_100g", "energy_100g", "fat_100g",
        "carbohydrates_100g", "proteins_100g", "fiber_100g",
      ];
      const missing = required.filter((r) => !(r in idx));
      if (missing.length) throw new Error(`CSV is missing expected columns: ${missing.join(", ")}`);
      continue;
    }

    scanned++;
    if (scanned % 1_000_000 === 0) console.log(`  scanned ${scanned / 1e6}M products, ${inMorocco} in Morocco...`);

    // Cheap pre-filter before paying for the full split.
    if (!line.includes(COUNTRY_TAG)) continue;
    const row = line.split("\t");
    if (row.length !== header.length) {
      reject("malformed line");
      continue;
    }
    const countries = (col(row, "countries_tags") ?? "").split(",");
    if (!countries.includes(COUNTRY_TAG)) continue;
    inMorocco++;

    const barcode = (col(row, "code") ?? "").trim();
    if (!barcode) {
      reject("no barcode");
      continue;
    }
    if (seen.has(barcode)) {
      reject("duplicate barcode");
      continue;
    }

    const name = (col(row, "product_name") ?? "").replace(/\s+/g, " ").trim().slice(0, 150);
    if (name.length < 2) {
      reject("no name");
      continue;
    }
    // Contributors sometimes type the barcode (or a stray number) as the name.
    if (/^[0-9][0-9 .\-]*$/.test(name)) {
      reject("numeric name");
      continue;
    }

    // Macros: required, per 100 g. kcal falls back to kJ when only energy_100g is set.
    let kcal = num(col(row, "energy-kcal_100g"));
    if (kcal === null) {
      const kj = num(col(row, "energy_100g"));
      if (kj !== null) kcal = kj / 4.184;
    }
    const protein = num(col(row, "proteins_100g"));
    const carbs = num(col(row, "carbohydrates_100g"));
    const fat = num(col(row, "fat_100g"));
    if (kcal === null || protein === null || carbs === null || fat === null) {
      reject("missing macros");
      continue;
    }
    if (kcal < 0 || protein < 0 || carbs < 0 || fat < 0 || kcal > 900 || protein + carbs + fat > 105) {
      reject("macros out of range");
      continue;
    }
    // Atwater sanity check: stated kcal must roughly match 4/4/9 macro math.
    const computed = protein * 4 + carbs * 4 + fat * 9;
    if (Math.abs(kcal - computed) > Math.max(25, 0.3 * Math.max(kcal, computed))) {
      reject("kcal inconsistent with macros");
      continue;
    }

    const fibre = num(col(row, "fiber_100g"));
    const brand = (col(row, "brands") ?? "").split(",")[0].trim().slice(0, 80) || null;
    const imageUrl = (col(row, "image_url") ?? "").trim() || null;
    const category = pickCategory(col(row, "categories_tags") ?? "");

    const food: FoodInsert = {
      name,
      brand,
      category,
      barcode,
      source: "off",
      image_url: imageUrl,
      kcal: round1(kcal),
      protein_g: round1(protein),
      carbs_g: round1(carbs),
      fat_g: round1(fat),
      fibre_g: fibre !== null && fibre >= 0 && fibre <= 100 ? round1(fibre) : 0,
    };

    for (const { col: micro, csv, factor, cap } of MICRO_MAP) {
      const raw = num(col(row, csv));
      const value = raw !== null && raw >= 0 && raw * factor <= cap ? round2(raw * factor) : null;
      food[micro] = value;
      if (value !== null) microCoverage[micro] = (microCoverage[micro] ?? 0) + 1;
    }
    // Sub-values can't exceed their parent macro; drop the sub-value if they do.
    if (food.sugar_g !== null && (food.sugar_g as number) > carbs + 1) food.sugar_g = null;
    if (food.saturated_fat_g !== null && (food.saturated_fat_g as number) > fat + 1) food.saturated_fat_g = null;
    // Salt fallback when sodium itself is unset (sodium = salt / 2.5).
    if (food.sodium_mg === null) {
      const salt = num(col(row, "salt_100g"));
      if (salt !== null && salt >= 0 && salt <= 40) food.sodium_mg = round2(salt * 400);
    }

    seen.add(barcode);
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    rows.push(food);
  }

  console.log(`\nScanned ${scanned} products; ${inMorocco} tagged Morocco; ${rows.length} passed the quality gate.\n`);
  console.log("Rejections:", rejects);
  console.log("Categories:", categoryCounts);
  console.log(
    "Micro coverage:",
    Object.fromEntries(
      MICRO_MAP.map(({ col: c }) => [c, `${(((microCoverage[c] ?? 0) / Math.max(1, rows.length)) * 100).toFixed(0)}%`])
    )
  );

  if (DRY_RUN) {
    const out = path.join(CACHE_DIR, "morocco-foods.json");
    writeFileSync(out, JSON.stringify(rows, null, 2));
    console.log(`\nDry run: no database writes. Full mapped data written to ${out}`);
    console.log("Sample:", JSON.stringify(rows.slice(0, 3), null, 2));
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

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("foods")
      .upsert(batch, { onConflict: "barcode", ignoreDuplicates: true });
    if (error) {
      throw new Error(
        `Insert failed at batch ${i / BATCH_SIZE + 1}/${Math.ceil(rows.length / BATCH_SIZE)}: ${error.message}\n` +
          "(Have you applied the barcode/source schema changes from supabase/schema.sql?)"
      );
    }
    inserted += batch.length;
    if (inserted % 2500 === 0 || inserted === rows.length) console.log(`  upserted ${inserted}/${rows.length}...`);
  }
  console.log(`\nDone. ${rows.length} foods sent (existing barcodes left untouched).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
