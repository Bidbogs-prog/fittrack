import { ArrowLeft, Info, Trash, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FoodPicker } from "@/components/food-picker";
import { MacroInline } from "@/components/macros";
import { requireAdmin } from "@/lib/auth";
import { GOALS, macrosForPortion, sumMacros } from "@/lib/nutrition";
import { MEAL_TYPES, type MealPlan, type PlanRequest } from "@/lib/types";
import {
  addPlanItem,
  addSavedMealToPlan,
  deletePlan,
  deletePlanItem,
  refreshPlanBrief,
  sendPlanForRequest,
  updatePlanDetails,
} from "../../actions";
import { refreshRequestBrief } from "@/lib/plan-brief";
import { PlanBriefCard } from "../../requests/brief";

export const metadata = { title: "Admin · Plan builder" };

interface SavedMealOption {
  id: string;
  name: string;
  items: { food_id: string | null; grams: number | null }[];
}

export default async function PlanBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ supabase, userId }, { id }, { error, message }] = await Promise.all([
    requireAdmin(),
    params,
    searchParams,
  ]);

  const [{ data: planData }, { data: savedMealData }, { data: requestData }] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("*, items:meal_plan_items(*, food:foods(*))")
      .eq("id", id)
      .maybeSingle(),
    // A draft built for a coach request (startPlanForRequest) shows that person's brief.
    // The admin's own dashboard-saved meals, for bulk-adding into the plan.
    supabase
      .from("saved_meals")
      .select("id, name, items:saved_meal_items(food_id, grams)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("plan_requests")
      .select("*")
      .eq("plan_id", id)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  if (!planData) notFound();
  const plan = planData as MealPlan & { draft?: boolean };
  const request = (requestData as PlanRequest | null) ?? null;
  const forRequest = plan.draft === true && request != null;
  // Requests sent before briefs existed: build it now from their live data.
  if (forRequest && !request.snapshot) {
    request.snapshot = await refreshRequestBrief(supabase, request.id, request.user_id);
  }
  const who = request?.full_name || request?.email || "them";

  // Only meals with at least one real food portion can feed a plan.
  const savedMeals = ((savedMealData ?? []) as SavedMealOption[])
    .map((m) => ({ ...m, foodCount: m.items.filter((it) => it.food_id != null).length }))
    .filter((m) => m.foodCount > 0);

  const dayTotal = sumMacros(plan.items.map((it) => macrosForPortion(it.food, it.grams)));
  const targets = forRequest ? (request.snapshot?.targets ?? null) : null;

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
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-flame">
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

      {message && (
        <p className="flex items-start gap-2 rounded-lg border border-flame/25 bg-flame/[0.06] px-3.5 py-3 text-sm text-flame">
          <Info className="mt-0.5 size-4 shrink-0" weight="bold" />
          {message}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          {error}
        </p>
      )}

      {plan.draft && !request && (
        <p className="rounded-lg border border-ink-700 px-3.5 py-3 text-sm text-paper-dim">
          Draft — its request was cancelled or resolved. Delete it, or keep building and assign it from Plan requests.
        </p>
      )}

      {forRequest && (
        <section className="grid gap-5 rounded-2xl border border-flame/30 bg-[linear-gradient(135deg,rgba(255,157,59,.08),rgba(242,112,31,.02))] p-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.16em] text-flame uppercase">Draft for {who}</p>
            <p className="mt-1 mb-4 text-xs text-paper-mute">
              {request.email} · requested {new Date(request.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </p>
            <PlanBriefCard brief={request.snapshot} note={request.note} />
            <form action={refreshPlanBrief} className="mt-3">
              <input type="hidden" name="plan_id" value={plan.id} />
              <button type="submit" className="text-xs text-paper-mute underline-offset-2 hover:text-paper hover:underline">
                Refresh with their latest data
              </button>
            </form>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {targets && (
              <div className="rounded-xl border border-ink-800 bg-ink-950/50 p-4">
                <p className="text-[11px] tracking-wide text-paper-mute uppercase">This plan vs their targets</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 font-mono text-xs tabular">
                  {(
                    [
                      ["kcal", dayTotal.kcal, targets.kcal],
                      ["Protein g", dayTotal.protein, targets.protein],
                      ["Carbs g", dayTotal.carbs, targets.carbs],
                      ["Fat g", dayTotal.fat, targets.fat],
                      ["Fibre g", dayTotal.fibre, targets.fibre],
                    ] as const
                  ).map(([label, have, want]) => {
                    const off = want > 0 ? (have - want) / want : 0;
                    return (
                      <div key={label} className="contents">
                        <dt className="text-paper-mute">{label}</dt>
                        <dd className="text-paper">
                          {Math.round(have)} / {want}
                        </dd>
                        <dd className={Math.abs(off) <= 0.1 ? "text-fibre" : "text-flame"}>
                          {off >= 0 ? "+" : "−"}
                          {Math.abs(Math.round(off * 100))}%
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="mt-2 text-[11px] text-paper-mute">Green = within 10% of their target.</p>
              </div>
            )}

            <form action={updatePlanDetails} className="flex flex-col gap-2">
              <input type="hidden" name="plan_id" value={plan.id} />
              <label htmlFor="plan-name" className="field-label">Plan name</label>
              <input id="plan-name" name="name" required defaultValue={plan.name} maxLength={120} className="field" />
              <label htmlFor="plan-desc" className="field-label">Message to {who} (optional)</label>
              <textarea
                id="plan-desc"
                name="description"
                rows={3}
                maxLength={1000}
                defaultValue={plan.description ?? ""}
                placeholder="How to use the plan, swaps, timing…"
                className="field resize-none"
              />
              <button type="submit" className="btn-press self-start rounded-lg border border-ink-700 px-3.5 py-2 text-xs font-semibold text-paper-dim hover:text-paper">
                Save details
              </button>
            </form>

            <form action={sendPlanForRequest} className="mt-auto">
              <input type="hidden" name="plan_id" value={plan.id} />
              <button
                type="submit"
                disabled={plan.items.length === 0}
                className="btn-press w-full rounded-xl btn-flame px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm &amp; send to {who}
              </button>
              <p className="mt-1.5 text-[11px] text-paper-mute">
                {plan.items.length === 0
                  ? "Add at least one item first."
                  : "They'll see it under “From your coach” on their Meal plans tab. You can unassign it later."}
              </p>
            </form>
          </div>
        </section>
      )}

      {/* add item */}
      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
        <h3 className="mb-4 font-display text-base font-semibold text-paper">Add an item</h3>
        {/* Single column until lg: with the sidebar, a tablet's content area
            can't fit the fixed 160+120px columns plus a usable picker. */}
        <form action={addPlanItem} className="grid gap-4 lg:grid-cols-[1fr_160px_120px_auto] lg:items-end">
          <input type="hidden" name="plan_id" value={plan.id} />
          <div className="min-w-0 space-y-2">
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
            className="btn-press rounded-xl btn-flame px-5 py-2.5 text-sm font-semibold"
          >
            Add
          </button>
        </form>
      </section>

      {/* bulk add from a saved meal */}
      {savedMeals.length > 0 && (
        <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
          <h3 className="font-display text-base font-semibold text-paper">
            Bulk add a saved meal
          </h3>
          <p className="mb-4 mt-1 text-xs text-paper-mute">
            Drops every food portion from one of your dashboard-saved meals into a meal slot
            in one go.
          </p>
          <form
            action={addSavedMealToPlan}
            className="grid gap-4 lg:grid-cols-[1fr_160px_auto] lg:items-end"
          >
            <input type="hidden" name="plan_id" value={plan.id} />
            <div className="min-w-0 space-y-2">
              <label htmlFor="saved_meal" className="field-label">Saved meal</label>
              <select
                id="saved_meal"
                name="saved_meal_id"
                required
                defaultValue=""
                className="field"
              >
                <option value="" disabled>
                  Pick a saved meal…
                </option>
                {savedMeals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.foodCount} food{m.foodCount === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="bulk-meal" className="field-label">Meal</label>
              <select id="bulk-meal" name="meal" required className="field capitalize">
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="btn-press rounded-xl btn-flame px-5 py-2.5 text-sm font-semibold"
            >
              Add all
            </button>
          </form>
        </section>
      )}

      {/* items by meal */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
                            className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-danger/10 hover:text-danger pointer-coarse:text-danger/80"
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
