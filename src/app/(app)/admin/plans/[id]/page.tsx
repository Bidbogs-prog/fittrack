import { ArrowLeft, Trash, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FoodPicker } from "@/components/food-picker";
import { MacroInline } from "@/components/macros";
import { requireAdmin } from "@/lib/auth";
import { GOALS, macrosForPortion, sumMacros } from "@/lib/nutrition";
import { MEAL_TYPES, type MealPlan } from "@/lib/types";
import { addPlanItem, deletePlan, deletePlanItem } from "../../actions";

export const metadata = { title: "Admin · Plan builder" };

export default async function PlanBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ supabase }, { id }, { error }] = await Promise.all([
    requireAdmin(),
    params,
    searchParams,
  ]);

  const { data: planData } = await supabase
    .from("meal_plans")
    .select("*, items:meal_plan_items(*, food:foods(*))")
    .eq("id", id)
    .maybeSingle();

  if (!planData) notFound();
  const plan = planData as MealPlan;

  const dayTotal = sumMacros(plan.items.map((it) => macrosForPortion(it.food, it.grams)));

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/plans"
          className="-my-2 inline-flex items-center gap-1.5 py-2 text-xs font-medium text-paper-mute hover:text-paper"
        >
          <ArrowLeft className="size-3.5" weight="bold" />
          All plans
        </Link>
        <form action={deletePlan}>
          <input type="hidden" name="id" value={plan.id} />
          <button
            type="submit"
            className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-3.5 py-2.5 text-xs font-semibold text-danger hover:bg-danger/10"
          >
            <Trash className="size-3.5" />
            Delete plan
          </button>
        </form>
      </div>

      <header className="rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
          {GOALS[plan.goal].label}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-paper">
          {plan.name}
        </h2>
        {plan.description && <p className="mt-2 text-sm text-paper-dim">{plan.description}</p>}
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-paper-mute">Day total</dt>
            <dd className="font-mono text-xl font-semibold text-paper tabular">
              {Math.round(dayTotal.kcal).toLocaleString()} kcal
            </dd>
          </div>
          <div className="self-end">
            <MacroInline macros={dayTotal} />
          </div>
        </dl>
      </header>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          {error}
        </p>
      )}

      {/* add item */}
      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
        <h3 className="mb-4 font-display text-base font-semibold text-paper">Add an item</h3>
        <form action={addPlanItem} className="grid gap-4 sm:grid-cols-[1fr_160px_120px_auto] sm:items-end">
          <input type="hidden" name="plan_id" value={plan.id} />
          <div className="space-y-2">
            <span className="field-label">Food</span>
            <FoodPicker name="food_id" />
          </div>
          <div className="space-y-2">
            <label htmlFor="meal" className="field-label">Meal</label>
            <select id="meal" name="meal" required className="field capitalize">
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="grams" className="field-label">Grams</label>
            <input
              id="grams"
              name="grams"
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              step="1"
              required
              defaultValue={100}
              className="field tabular"
            />
          </div>
          <button
            type="submit"
            className="btn-press rounded-xl bg-lime px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
          >
            Add
          </button>
        </form>
      </section>

      {/* items by meal */}
      <section className="grid gap-5 lg:grid-cols-2">
        {MEAL_TYPES.map((meal) => {
          const items = plan.items.filter((it) => it.meal === meal);
          const total = sumMacros(items.map((it) => macrosForPortion(it.food, it.grams)));
          return (
            <article key={meal} className="rounded-2xl border border-ink-800 bg-ink-900/60">
              <header className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
                <h4 className="font-display text-sm font-semibold capitalize text-paper">{meal}</h4>
                <span className="font-mono text-xs text-paper-dim tabular">
                  {Math.round(total.kcal)} kcal
                </span>
              </header>
              {items.length === 0 ? (
                <p className="px-5 py-6 text-center text-xs text-paper-mute">Empty.</p>
              ) : (
                <ul className="divide-y divide-ink-800/70">
                  {items.map((item) => {
                    const m = macrosForPortion(item.food, item.grams);
                    return (
                      <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-paper">{item.food.name}</p>
                          <p className="text-[11px] text-paper-mute">
                            {item.grams} g · {Math.round(m.kcal)} kcal
                          </p>
                        </div>
                        <form action={deletePlanItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="plan_id" value={plan.id} />
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
            </article>
          );
        })}
      </section>
    </div>
  );
}
