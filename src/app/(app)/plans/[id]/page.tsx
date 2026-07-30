import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FoodImage } from "@/components/food-image";
import { MacroInline } from "@/components/macros";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { getProfile } from "@/lib/auth";
import { GOALS, calcTargets, macrosForPortion, sumMacros } from "@/lib/nutrition";
import { MEAL_TYPES, type MealPlan } from "@/lib/types";

export const metadata = { title: "Meal plan" };

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ supabase, profile }, { id }] = await Promise.all([getProfile(), params]);

  const { data } = await supabase
    .from("meal_plans")
    .select("*, items:meal_plan_items(*, food:foods(*))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const plan = data as MealPlan;

  const total = sumMacros(plan.items.map((it) => macrosForPortion(it.food, it.grams)));
  const targets = calcTargets(profile);
  const fitPct = targets ? Math.round((total.kcal / targets.kcal) * 100) : null;

  return (
    <div className="space-y-7">
      <Link
        href="/plans"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-paper-mute hover:text-paper"
      >
        <ArrowLeft className="size-3.5" weight="bold" />
        All plans
      </Link>

      <Reveal as="header" onScroll={false} className="rounded-2xl border border-ink-800 bg-ink-900/60 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
          {GOALS[plan.goal].label}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tighter text-paper">
          {plan.name}
        </h1>
        {plan.description && (
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-paper-dim">
            {plan.description}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-paper-mute">Day total</p>
            <p className="font-mono text-2xl font-semibold tracking-tight text-paper tabular">
              <CountUp value={Math.round(total.kcal)} /> <span className="text-sm text-paper-mute">kcal</span>
            </p>
          </div>
          <MacroInline macros={total} />
          {fitPct !== null && (
            <p className="rounded-full bg-lime/[0.08] px-3 py-1.5 text-xs font-medium text-lime ring-1 ring-inset ring-lime/25">
              {fitPct}% of your {targets!.kcal.toLocaleString()} kcal target
            </p>
          )}
        </div>
      </Reveal>

      <Reveal as="section" className="grid gap-5 lg:grid-cols-2" stagger={0.1} start="top 90%">
        {MEAL_TYPES.map((meal) => {
          const items = plan.items.filter((it) => it.meal === meal);
          if (items.length === 0) return null;
          const mealTotal = sumMacros(items.map((it) => macrosForPortion(it.food, it.grams)));
          return (
            <article key={meal} data-reveal className="rounded-2xl border border-ink-800 bg-ink-900/60">
              <header className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
                <h2 className="font-display text-base font-semibold capitalize text-paper">{meal}</h2>
                <span className="font-mono text-sm text-paper-dim tabular">
                  {Math.round(mealTotal.kcal)} kcal
                </span>
              </header>
              <ul className="divide-y divide-ink-800/70">
                {items.map((item) => {
                  const m = macrosForPortion(item.food, item.grams);
                  return (
                    <li key={item.id} className="flex items-center gap-3.5 px-5 py-3">
                      <FoodImage src={item.food.image_url} alt="" className="size-10 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-paper">{item.food.name}</p>
                        <p className="truncate text-[11px] text-paper-mute">
                          {item.grams} g · P {m.protein.toFixed(1)} · C {m.carbs.toFixed(1)} · F{" "}
                          {m.fat.toFixed(1)} · Fb {m.fibre.toFixed(1)}
                        </p>
                      </div>
                      <span className="font-mono text-sm text-paper-dim tabular">
                        {Math.round(m.kcal)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </Reveal>
    </div>
  );
}
