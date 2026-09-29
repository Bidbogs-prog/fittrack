import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Orbit } from "@/components/orbit/orbit";
import { getActiveTargets } from "@/lib/adaptive";
import { getProfile } from "@/lib/auth";
import { MEAL_DEFAULT_MIN, formatClock } from "@/lib/day-time";
import { macrosForPortion, sumMacros } from "@/lib/nutrition";
import { MEAL_TYPES, type MealPlan, type MealType } from "@/lib/types";
import { toDateString } from "../../dashboard/day-data";
import { PlanActions } from "./plan-actions";

export const metadata = { title: "Meal plan" };

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ supabase, userId, profile }, { id }, t, tm] = await Promise.all([
    getProfile(),
    params,
    getTranslations("plans"),
    getTranslations("meals"),
  ]);

  const { data } = await supabase
    .from("meal_plans")
    .select("*, items:meal_plan_items(*, food:foods(*))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const plan = data as MealPlan;

  const [active, format] = await Promise.all([getActiveTargets(supabase, userId, profile), getFormatter()]);
  const total = sumMacros(plan.items.map((it) => macrosForPortion(it.food, it.grams)));
  const targetKcal = active?.targets.kcal ?? null;
  const fitPct = targetKcal ? Math.round((total.kcal / targetKcal) * 100) : null;

  // Plans have meals, not clock times: each sits at its meal's typical time.
  const meals = [...MEAL_TYPES]
    .sort((a, b) => MEAL_DEFAULT_MIN[a] - MEAL_DEFAULT_MIN[b])
    .map((meal) => {
      const items = plan.items.filter((it) => it.meal === meal);
      return { meal, items, macros: sumMacros(items.map((it) => macrosForPortion(it.food, it.grams))) };
    })
    .filter((m) => m.items.length > 0);
  const first = meals[0]?.meal as MealType | undefined;
  const last = meals[meals.length - 1]?.meal as MealType | undefined;
  const windowLabel =
    first && last ? `${formatClock(MEAL_DEFAULT_MIN[first])}–${formatClock(MEAL_DEFAULT_MIN[last])}` : "";

  const tag =
    plan.assigned_to != null ? t("tagAssigned") : plan.owner_id != null ? t("tagAi") : t(`goalChip.${plan.goal}`);
  const coachAsk = t("adaptQuestion", {
    name: plan.name,
    kcal: Math.round(total.kcal),
    protein: Math.round(total.protein),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-3.5">
        <Link href="/plans" className="inline-flex min-h-9 items-center gap-1 self-start text-sm text-paper-mute hover:text-paper">
          <CaretLeft weight="bold" className="size-3.5 rtl:-scale-x-100" />
          {t("back")}
        </Link>
        <div className="lg:hidden">
          <p className="font-mono text-[10px] font-medium tracking-[0.1em] text-flame uppercase">{tag}</p>
          <h1 className="mt-1 font-display text-[26px] leading-[1.1] font-bold tracking-[-0.03em] text-paper">{plan.name}</h1>
        </div>
        <div className="self-center">
          <Orbit
            window={
              first && last ? { startMin: MEAL_DEFAULT_MIN[first], endMin: MEAL_DEFAULT_MIN[last] } : null
            }
            dots={meals.map((m) => ({ key: m.meal, minutes: MEAL_DEFAULT_MIN[m.meal] }))}
            dotRadius={9}
            ghost
            labels
            summary={t("dialSummary", { kcal: Math.round(total.kcal), meals: meals.length })}
            className="size-[220px] lg:size-[340px]"
          >
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="font-mono text-[30px] font-semibold tracking-[-0.04em] text-paper tabular lg:text-[44px]">
                  {format.number(Math.round(total.kcal))}
                </p>
                <p className="text-[11px] text-paper-mute lg:text-xs">
                  kcal{windowLabel && ` · ${windowLabel}`}
                </p>
              </div>
            </div>
          </Orbit>
        </div>
        <p className="text-[13px] leading-relaxed text-paper-mute max-lg:hidden">{t("ghostHint")}</p>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:pt-[30px]">
        <div className="max-lg:hidden">
          <p className="font-mono text-[11px] font-medium tracking-[0.1em] text-flame uppercase">{tag}</p>
          <h1 className="mt-1 font-display text-[44px] leading-[1.02] font-bold tracking-[-0.04em] text-paper">{plan.name}</h1>
        </div>
        {plan.description && (
          <p className="max-w-[58ch] text-[15px] leading-relaxed text-pretty text-paper-dim lg:text-base">
            {plan.description}
          </p>
        )}

        <ol className="overflow-hidden rounded-[18px] border border-ink-800 bg-ink-900 lg:rounded-[22px]">
          {meals.map((m) => (
            <li
              key={m.meal}
              className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-ink-800 px-3.5 py-3 last:border-b-0 lg:grid-cols-[80px_minmax(0,1fr)_80px] lg:px-5 lg:py-4"
            >
              <span className="font-mono text-xs font-medium text-flame tabular lg:text-sm">
                {formatClock(MEAL_DEFAULT_MIN[m.meal])}
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold text-paper lg:text-base">{tm(m.meal)}</p>
                <p className="text-xs text-paper-mute lg:text-[13px]">
                  {m.items.map((it) => `${it.food.name} ${it.grams} g`).join(" · ")}
                </p>
              </div>
              <span className="text-end font-mono text-xs text-paper-dim tabular lg:text-sm">
                {format.number(Math.round(m.macros.kcal))}
              </span>
            </li>
          ))}
        </ol>

        <dl className="grid grid-cols-4 gap-2 lg:gap-2.5">
          {(
            [
              [t("ofTarget"), fitPct != null ? `${fitPct}%` : "—", "text-flame-glow", true],
              [t("protein"), `${Math.round(total.protein)} g`, "text-protein", false],
              [t("carbs"), `${Math.round(total.carbs)} g`, "text-carbs", false],
              [t("fat"), `${Math.round(total.fat)} g`, "text-fat", false],
            ] as const
          ).map(([label, value, color, accent]) => (
            <div
              key={label}
              className={`rounded-[14px] border bg-ink-900 p-2.5 lg:p-3 ${accent ? "border-flame/35" : "border-ink-800"}`}
            >
              <dt className="text-[11px] text-paper-mute">{label}</dt>
              <dd className={`font-mono text-sm font-medium tabular lg:text-xl ${color}`}>{value}</dd>
            </div>
          ))}
        </dl>

        <PlanActions
          planId={plan.id}
          date={toDateString(new Date())}
          canDelete={plan.owner_id === userId}
          coachHref={`/coach?c=new&q=${encodeURIComponent(coachAsk)}`}
        />
      </div>
    </div>
  );
}
