import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { getProfile } from "@/lib/auth";
import { GOALS, macrosForPortion, sumMacros } from "@/lib/nutrition";
import type { Goal, MealPlan } from "@/lib/types";

export const metadata = { title: "Meal plans" };

const GOAL_KEYS = Object.keys(GOALS) as Goal[];

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string }>;
}) {
  const [{ supabase, profile }, { g }] = await Promise.all([getProfile(), searchParams]);

  const goal: Goal = GOAL_KEYS.find((k) => k === g) ?? profile.goal ?? "maintain";

  const { data } = await supabase
    .from("meal_plans")
    .select("*, items:meal_plan_items(*, food:foods(*))")
    .eq("goal", goal)
    .order("created_at", { ascending: false });
  const plans = (data ?? []) as MealPlan[];

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
          Coach-built days
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
          Meal plans
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm text-paper-dim">
          Full days of eating assembled from the food library.
          {profile.goal && goal === profile.goal && " Showing plans for your current goal."}
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filter by goal">
        {GOAL_KEYS.map((key) => (
          <Link
            key={key}
            href={`/plans?g=${key}`}
            className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors pointer-fine:py-1.5 ${
              goal === key
                ? "bg-lime text-lime-ink"
                : "border border-ink-700 text-paper-dim hover:text-paper"
            }`}
          >
            {GOALS[key].label}
            {profile.goal === key && " · yours"}
          </Link>
        ))}
      </nav>

      {plans.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-16 text-center text-sm text-paper-mute">
          No {GOALS[goal].label.toLowerCase()} plans yet — your coach is cooking.
        </p>
      ) : (
        <Reveal as="ul" className="grid gap-4 lg:grid-cols-2" stagger={0.08} start="top 92%">
          {plans.map((plan) => {
            const total = sumMacros(plan.items.map((it) => macrosForPortion(it.food, it.grams)));
            return (
              <li key={plan.id} data-reveal>
                <Link
                  href={`/plans/${plan.id}`}
                  className="btn-press card-lift group block rounded-2xl border border-ink-800 bg-ink-900/60 p-5 hover:border-ink-600"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-base font-semibold tracking-tight text-paper">
                      {plan.name}
                    </h2>
                    <ArrowRight
                      weight="bold"
                      className="mt-1 size-4 shrink-0 text-paper-mute transition-transform group-hover:translate-x-0.5 group-hover:text-lime"
                    />
                  </div>
                  {plan.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-paper-mute">
                      {plan.description}
                    </p>
                  )}
                  <dl className="mt-4 grid grid-cols-5 gap-px overflow-hidden rounded-lg bg-ink-800">
                    {(
                      [
                        ["kcal", Math.round(total.kcal)],
                        ["P", Math.round(total.protein)],
                        ["C", Math.round(total.carbs)],
                        ["F", Math.round(total.fat)],
                        ["Fb", Math.round(total.fibre)],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="bg-ink-900 px-1 py-2 text-center sm:px-2">
                        <dt className="text-[10px] uppercase tracking-wide text-paper-mute">{label}</dt>
                        <dd className="mt-0.5 font-mono text-[13px] font-medium text-paper tabular sm:text-sm">
                          {value.toLocaleString()}
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
