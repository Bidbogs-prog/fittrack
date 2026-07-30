import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { FoodImage } from "@/components/food-image";
import { FoodSearch } from "@/components/food-search";
import { Reveal } from "@/components/motion/reveal";
import { Pagination } from "@/components/pagination";
import { requireUser } from "@/lib/auth";
import { FOODS_PAGE_SIZE, parseCategory, sanitizeSearch, searchFoods } from "@/lib/foods";
import { MICRONUTRIENTS, formatAmount, percentDv } from "@/lib/nutrition";
import { FOOD_CATEGORIES, MICRO_KEYS } from "@/lib/types";

export const metadata = { title: "Food library" };

function href(params: { c?: string | null; q?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.c) sp.set("c", params.c);
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/foods?${qs}` : "/foods";
}

export default async function FoodsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; q?: string; page?: string }>;
}) {
  const [{ supabase }, params] = await Promise.all([requireUser(), searchParams]);

  const category = parseCategory(params.c);
  const q = sanitizeSearch(params.q ?? "");
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const { foods, total } = await searchFoods(supabase, { q, category, page });
  const totalPages = Math.max(1, Math.ceil(total / FOODS_PAGE_SIZE));

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
          Verified per 100 g
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
          Food library
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm text-paper-dim">
          Curated by your coach and extended with the Open Food Facts database — exact
          nutritional facts per 100 grams, the same numbers your diary math runs on.
        </p>
      </header>

      <FoodSearch initialQuery={q} category={category} />

      <nav className="flex flex-wrap gap-2" aria-label="Filter by category">
        <Link
          href={href({ q })}
          className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:py-1.5 ${
            !category ? "bg-lime text-lime-ink" : "border border-ink-700 text-paper-dim hover:text-paper"
          }`}
        >
          All
        </Link>
        {FOOD_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={href({ c: cat, q })}
            className={`rounded-full px-3.5 py-2 text-xs font-semibold capitalize transition-colors sm:py-1.5 ${
              category === cat
                ? "bg-lime text-lime-ink"
                : "border border-ink-700 text-paper-dim hover:text-paper"
            }`}
          >
            {cat.replace("-", " & ")}
          </Link>
        ))}
      </nav>

      {foods.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-16 text-center text-sm text-paper-mute">
          {q ? <>Nothing matches &ldquo;{q}&rdquo;{category ? " in this category" : ""}.</> : "No foods in this category yet."}
        </p>
      ) : (
        <Reveal
          // Remount on every new result set: client-side navigation swaps the
          // grid's DOM nodes, and the entrance animation only runs on mount —
          // without this, CSS-prehidden cards would stay invisible.
          key={`${category ?? "all"}|${q}|${page}`}
          as="ul"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          stagger={0.05}
          start="top 92%"
        >
          {foods.map((food) => {
            const providedMicros = MICRO_KEYS.filter((key) => food[key] != null);
            return (
            <li
              key={food.id}
              data-reveal
              className="card-lift rounded-2xl border border-ink-800 bg-ink-900/60 p-4 hover:border-ink-600"
            >
              <div className="flex items-start gap-3.5">
                <FoodImage src={food.image_url} alt={food.name} className="size-16 rounded-xl" />
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-paper">{food.name}</h2>
                  <p className="text-[11px] capitalize text-paper-mute">
                    {food.brand ? `${food.brand} · ` : ""}
                    {food.category.replace("-", " & ")}
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold tracking-tight text-lime tabular">
                    {Math.round(food.kcal)}
                    <span className="text-xs text-paper-mute"> kcal / 100 g</span>
                  </p>
                </div>
              </div>
              <dl className="mt-3.5 grid grid-cols-4 gap-px overflow-hidden rounded-lg bg-ink-800">
                {(
                  [
                    ["Protein", food.protein_g],
                    ["Carbs", food.carbs_g],
                    ["Fat", food.fat_g],
                    ["Fibre", food.fibre_g],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="bg-ink-900 px-1.5 py-2 text-center sm:px-2">
                    <dt className="text-[10px] uppercase tracking-wide text-paper-mute">{label}</dt>
                    <dd className="mt-0.5 font-mono text-[13px] font-medium text-paper tabular sm:text-sm">
                      {value}g
                    </dd>
                  </div>
                ))}
              </dl>
              {providedMicros.length > 0 && (
                <details className="group mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-paper-mute transition-colors hover:text-paper [&::-webkit-details-marker]:hidden">
                    <CaretRight weight="bold" className="size-3 transition-transform group-open:rotate-90" />
                    Full nutrition &amp; daily values
                  </summary>
                  <p className="mt-2 text-[11px] text-paper-mute">
                    Per 100 g · % of adult daily value
                  </p>
                  <ul className="mt-2 divide-y divide-ink-800/70 rounded-lg border border-ink-800">
                    {providedMicros.map((key) => {
                      const def = MICRONUTRIENTS[key];
                      const value = food[key] as number;
                      const pct = percentDv(key, value);
                      return (
                        <li key={key} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-xs">
                          <span className="text-paper-dim">{def.label}</span>
                          <span className="font-mono text-paper tabular">
                            {formatAmount(value)} {def.unit}
                            {pct != null && <span className="text-paper-mute"> · {pct}%</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
              {food.source !== "manual" && (
                <p className="mt-3 text-[10px] text-paper-mute">
                  Source: {food.source === "off" ? "Open Food Facts" : "USDA"}
                </p>
              )}
            </li>
            );
          })}
        </Reveal>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        makeHref={(p) => href({ c: category, q, page: p })}
      />

      <footer className="border-t border-ink-800 pt-5">
        <p className="text-xs text-paper-mute">
          Includes data from{" "}
          <a
            href="https://world.openfoodfacts.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-paper"
          >
            Open Food Facts
          </a>
          , available under the{" "}
          <a
            href="https://opendatacommons.org/licenses/odbl/1-0/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-paper"
          >
            Open Database License
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
