import Link from "next/link";
import { FoodImage } from "@/components/food-image";
import { Reveal } from "@/components/motion/reveal";
import { requireUser } from "@/lib/auth";
import { FOOD_CATEGORIES, type Food } from "@/lib/types";

export const metadata = { title: "Food library" };

export default async function FoodsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const [{ supabase }, { c }] = await Promise.all([requireUser(), searchParams]);

  const category = FOOD_CATEGORIES.find((cat) => cat === c) ?? null;

  let query = supabase.from("foods").select("*").order("name");
  if (category) query = query.eq("category", category);
  const { data } = await query;
  const foods = (data ?? []) as Food[];

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
          Every item here is curated by your coach with exact nutritional facts per 100 grams —
          the same numbers your diary math runs on.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filter by category">
        <Link
          href="/foods"
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            !category ? "bg-lime text-lime-ink" : "border border-ink-700 text-paper-dim hover:text-paper"
          }`}
        >
          All
        </Link>
        {FOOD_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/foods?c=${cat}`}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
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
          No foods in this category yet.
        </p>
      ) : (
        <Reveal as="ul" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05} start="top 92%">
          {foods.map((food) => (
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
                  <div key={label} className="bg-ink-900 px-2 py-2 text-center">
                    <dt className="text-[10px] uppercase tracking-wide text-paper-mute">{label}</dt>
                    <dd className="mt-0.5 font-mono text-sm font-medium text-paper tabular">
                      {value}g
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </Reveal>
      )}
    </div>
  );
}
