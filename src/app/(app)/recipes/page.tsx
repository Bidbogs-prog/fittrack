import { BowlFood, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { requireUser } from "@/lib/auth";
import { recipePerServing } from "@/lib/diary";
import type { Recipe } from "@/lib/types";

export const metadata = { title: "Your recipes" };

export default async function RecipesPage() {
  const { supabase, userId } = await requireUser();

  const { data } = await supabase
    .from("recipes")
    .select("*, items:recipe_items(*, food:foods(*))")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  const recipes = (data ?? []) as Recipe[];

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
            Cook once, log in one tap
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
            Your recipes
          </h1>
          <p className="mt-2 max-w-[60ch] text-sm text-paper-dim">
            Save multi-ingredient meals and log whole servings from the diary. Macros
            come straight from each ingredient&rsquo;s per-100 g facts.
          </p>
        </div>
        <Link
          href="/recipes/new"
          className="btn-press inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-lime px-3.5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
        >
          <Plus weight="bold" className="size-4" />
          New recipe
        </Link>
      </header>

      {recipes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-16 text-center text-sm text-paper-mute">
          No recipes yet. Build your first one and it shows up in the food picker.
        </p>
      ) : (
        <Reveal
          as="ul"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
          stagger={0.05}
          start="top 92%"
        >
          {recipes.map((recipe) => {
            const per = recipePerServing(recipe.items, Number(recipe.servings));
            return (
              <li key={recipe.id} data-reveal>
                <Link
                  href={`/recipes/${recipe.id}`}
                  className="card-lift block rounded-2xl border border-ink-800 bg-ink-900/60 p-4 hover:border-ink-600"
                >
                  <div className="flex items-start gap-3.5">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-paper-dim">
                      <BowlFood className="size-6" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-paper">{recipe.name}</h2>
                      <p className="text-[11px] text-paper-mute">
                        {recipe.items.length} ingredient{recipe.items.length === 1 ? "" : "s"} ·{" "}
                        {Number(recipe.servings)} serving{Number(recipe.servings) === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1 font-mono text-lg font-semibold tracking-tight text-lime tabular">
                        {Math.round(per.kcal)}
                        <span className="text-xs text-paper-mute"> kcal / serving</span>
                      </p>
                    </div>
                  </div>
                  <dl className="mt-3.5 grid grid-cols-4 gap-px overflow-hidden rounded-lg bg-ink-800">
                    {(
                      [
                        ["Protein", per.protein],
                        ["Carbs", per.carbs],
                        ["Fat", per.fat],
                        ["Fibre", per.fibre],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="bg-ink-900 px-1.5 py-2 text-center sm:px-2">
                        <dt className="text-[10px] uppercase tracking-wide text-paper-mute">
                          {label}
                        </dt>
                        <dd className="mt-0.5 font-mono text-[13px] font-medium text-paper tabular sm:text-sm">
                          {value.toFixed(1)}g
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Link>
              </li>
            );
          })}
        </Reveal>
      )}
    </div>
  );
}
