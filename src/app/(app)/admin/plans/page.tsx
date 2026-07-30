import { ArrowRight, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { GOALS } from "@/lib/nutrition";
import type { Goal } from "@/lib/types";
import { createPlan } from "../actions";

export const metadata = { title: "Admin · Meal plans" };

interface PlanRow {
  id: string;
  name: string;
  goal: Goal;
  description: string | null;
  items: { count: number }[];
}

export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ supabase }, { error }] = await Promise.all([requireAdmin(), searchParams]);

  const { data } = await supabase
    .from("meal_plans")
    .select("id, name, goal, description, items:meal_plan_items(count)")
    .order("created_at", { ascending: false });
  const plans = (data ?? []) as PlanRow[];

  return (
    <div className="space-y-8">
      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight text-paper">
          Create a meal plan
        </h2>
        <p className="mb-5 mt-1 text-xs text-paper-mute">
          Name it, pick which goal it serves, then build the day from the food library.
        </p>
        <form action={createPlan} className="grid gap-4 md:grid-cols-[1fr_180px]">
          <div className="space-y-2">
            <label htmlFor="name" className="field-label">Plan name</label>
            <input id="name" name="name" required placeholder="High-protein cut · 4 meals" className="field" />
          </div>
          <div className="space-y-2">
            <label htmlFor="goal" className="field-label">Goal</label>
            <select id="goal" name="goal" required defaultValue="lose" className="field">
              {(Object.keys(GOALS) as Goal[]).map((g) => (
                <option key={g} value={g}>
                  {GOALS[g].label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="description" className="field-label">Description (optional)</label>
            <textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Who is this for, and how to use it"
              className="field resize-none"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="btn-press rounded-xl bg-lime px-6 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
            >
              Create and build
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold tracking-tight text-paper">
          Plans <span className="font-mono text-sm text-paper-mute tabular">({plans.length})</span>
        </h2>
        {plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-14 text-center text-sm text-paper-mute">
            No plans yet — create the first one above.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {plans.map((plan) => (
              <li key={plan.id}>
                <Link
                  href={`/admin/plans/${plan.id}`}
                  className="btn-press group flex items-center justify-between gap-4 rounded-2xl border border-ink-800 bg-ink-900/60 px-5 py-4 transition-colors hover:border-ink-600"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold text-paper">
                      {plan.name}
                    </p>
                    <p className="mt-0.5 text-xs text-paper-mute">
                      {GOALS[plan.goal].label} · {plan.items[0]?.count ?? 0} items
                    </p>
                  </div>
                  <ArrowRight
                    weight="bold"
                    className="size-4 shrink-0 text-paper-mute transition-transform group-hover:translate-x-0.5 group-hover:text-lime"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
