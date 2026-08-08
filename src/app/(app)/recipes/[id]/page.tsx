import { Plus, Trash, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FoodPicker } from "@/components/food-picker";
import { requireUser } from "@/lib/auth";
import { recipePerServing, recipeTotals } from "@/lib/diary";
import { macrosForPortion } from "@/lib/nutrition";
import type { Recipe } from "@/lib/types";
import { addRecipeItem, deleteRecipe, deleteRecipeItem, updateRecipe } from "../actions";

export const metadata = { title: "Edit recipe" };

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ supabase, userId }, { id }, { error }] = await Promise.all([
    requireUser(),
    params,
    searchParams,
  ]);

  const { data } = await supabase
    .from("recipes")
    .select("*, items:recipe_items(*, food:foods(*))")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) notFound();
  const recipe = data as Recipe;
  const items = [...recipe.items].sort((a, b) => a.id.localeCompare(b.id));

  const total = recipeTotals(items);
  const per = recipePerServing(items, Number(recipe.servings));

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/recipes"
          className="text-xs font-medium text-paper-mute underline-offset-4 hover:text-paper hover:underline"
        >
          ← Your recipes
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
          {recipe.name}
        </h1>
      </header>

      {error && (
        <p className="flex max-w-xl items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}

      {/* details */}
      <form action={updateRecipe} className="max-w-xl space-y-4">
        <input type="hidden" name="id" value={recipe.id} />
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <label htmlFor="name" className="field-label">Name</label>
            <input
              id="name"
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={recipe.name}
              className="field"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="servings" className="field-label">Servings</label>
            <input
              id="servings"
              name="servings"
              type="number"
              inputMode="decimal"
              min={0.5}
              max={100}
              step="0.5"
              required
              defaultValue={Number(recipe.servings)}
              className="field w-28 tabular"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="description" className="field-label">Notes (optional)</label>
          <textarea
            id="description"
            name="description"
            maxLength={500}
            rows={2}
            defaultValue={recipe.description ?? ""}
            className="field resize-y"
          />
        </div>
        <button
          type="submit"
          className="btn-press rounded-lg border border-ink-700 px-4 py-2.5 text-xs font-semibold text-paper-dim transition-colors hover:border-lime/50 hover:text-lime"
        >
          Save details
        </button>
      </form>

      {/* ingredients */}
      <section className="max-w-xl rounded-2xl border border-ink-800 bg-ink-900/60">
        <header className="border-b border-ink-800 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-paper">Ingredients</h2>
          <p className="text-[11px] text-paper-mute">
            Raw weights in grams — totals update as you build.
          </p>
        </header>

        {items.length === 0 ? (
          <p className="px-5 py-7 text-center text-sm text-paper-mute">
            Nothing yet — add the first ingredient below.
          </p>
        ) : (
          <ul className="divide-y divide-ink-800/70">
            {items.map((item) => {
              const m = macrosForPortion(item.food, item.grams);
              return (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-paper">{item.food.name}</p>
                    <p className="truncate text-[11px] text-paper-mute">
                      {item.grams} g · P {m.protein.toFixed(1)} · C {m.carbs.toFixed(1)} · F{" "}
                      {m.fat.toFixed(1)}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-paper-dim tabular">
                    {Math.round(m.kcal)}
                  </span>
                  <form action={deleteRecipeItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="recipe_id" value={recipe.id} />
                    <button
                      type="submit"
                      aria-label={`Remove ${item.food.name}`}
                      className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash className="size-4" />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <form action={addRecipeItem} className="space-y-3 border-t border-ink-800 px-5 py-4">
          <input type="hidden" name="recipe_id" value={recipe.id} />
          <FoodPicker />
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <label htmlFor="grams" className="field-label">Amount (grams)</label>
              <input
                id="grams"
                name="grams"
                type="number"
                inputMode="decimal"
                min={1}
                max={5000}
                step="1"
                defaultValue="100"
                required
                className="field tabular"
              />
            </div>
            <button
              type="submit"
              className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-lime px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
            >
              <Plus weight="bold" className="size-4" />
              Add
            </button>
          </div>
        </form>
      </section>

      {/* totals */}
      {items.length > 0 && (
        <section className="max-w-xl rounded-2xl border border-lime/20 bg-lime/[0.05] p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
            Per serving ({Number(recipe.servings)} total)
          </h2>
          <dl className="mt-3 grid grid-cols-3 gap-x-1 gap-y-3 text-center sm:grid-cols-5">
            {(
              [
                ["kcal", per.kcal, 0],
                ["protein", per.protein, 1],
                ["carbs", per.carbs, 1],
                ["fat", per.fat, 1],
                ["fibre", per.fibre, 1],
              ] as const
            ).map(([label, value, dp]) => (
              <div key={label}>
                <dt className="text-[10px] uppercase tracking-wide text-paper-mute">{label}</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-paper tabular">
                  {value.toFixed(dp)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-paper-mute">
            Whole recipe: {Math.round(total.kcal)} kcal · P {total.protein.toFixed(0)} · C{" "}
            {total.carbs.toFixed(0)} · F {total.fat.toFixed(0)} · Fb {total.fibre.toFixed(0)}
          </p>
        </section>
      )}

      <footer className="max-w-xl border-t border-ink-800 pt-5">
        <form action={deleteRecipe}>
          <input type="hidden" name="id" value={recipe.id} />
          <button
            type="submit"
            className="btn-press rounded-lg border border-danger/40 px-4 py-2.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/10"
          >
            Delete recipe
          </button>
        </form>
        <p className="mt-2 text-[11px] text-paper-mute">
          Diary entries that logged this recipe keep their macro snapshots.
        </p>
      </footer>
    </div>
  );
}
