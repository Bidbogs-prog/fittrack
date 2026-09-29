import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { MiniDial } from "@/components/orbit/orbit";
import { getActiveTargets } from "@/lib/adaptive";
import { getProfile } from "@/lib/auth";
import { GOALS, macrosForPortion, sumMacros } from "@/lib/nutrition";
import type { Goal, MealPlan } from "@/lib/types";
import { PlanTools } from "./plan-tools";

export const metadata = { title: "Meal plans" };

const GOAL_KEYS = Object.keys(GOALS) as Goal[];

type Kind = "assigned" | "ai" | "library";

async function PlanCard({
  plan,
  kind,
  targetKcal,
  tag,
}: {
  plan: MealPlan;
  kind: Kind;
  targetKcal: number | null;
  tag: string;
}) {
  const format = await getFormatter();
  const total = sumMacros(plan.items.map((it) => macrosForPortion(it.food, it.grams)));
  const pct = targetKcal ? Math.round((total.kcal / targetKcal) * 100) : null;
  const kcal = format.number(Math.round(total.kcal));
  const surface =
    kind === "assigned"
      ? "border-flame/45 bg-[linear-gradient(160deg,rgba(255,157,59,0.1),var(--ink-900)_60%)]"
      : kind === "ai"
        ? "border-dashed border-ink-600 bg-ink-900"
        : "border-ink-800 bg-ink-900";
  return (
    <Link
      href={`/plans/${plan.id}`}
      className={`btn-press card-lift group flex items-center gap-3.5 rounded-[20px] border p-3 lg:flex-col lg:items-stretch lg:gap-3 lg:rounded-[22px] lg:p-[18px] ${surface}`}
    >
      <span className="lg:hidden">
        <MiniDial fraction={pct != null ? pct / 100 : null} size={64} stroke={3.5}>
          <span className="font-mono text-[11px] font-medium text-paper tabular">{kcal}</span>
        </MiniDial>
      </span>
      <span className="self-center max-lg:hidden">
        <MiniDial fraction={pct != null ? pct / 100 : null} size={140} stroke={2.5}>
          <span className="flex flex-col items-center font-mono text-[22px] font-semibold tracking-[-0.03em] text-paper tabular">
            {kcal}
            <span className="font-sans text-[10px] font-normal tracking-[0.1em] text-paper-mute">KCAL</span>
          </span>
        </MiniDial>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] font-medium tracking-[0.1em] text-flame uppercase">{tag}</span>
        <span className="mt-0.5 block truncate font-display text-base font-semibold text-paper lg:text-lg">
          {plan.name}
        </span>
        <span className="mt-0.5 block font-mono text-xs text-paper-mute tabular">
          {Math.round(total.protein)} g P{pct != null ? ` · ${pct}%` : ""}
        </span>
      </span>
      <CaretRight weight="bold" className="size-4 shrink-0 text-paper-mute lg:hidden rtl:-scale-x-100" />
    </Link>
  );
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string }>;
}) {
  const [{ supabase, userId, profile }, { g }, t] = await Promise.all([
    getProfile(),
    searchParams,
    getTranslations("plans"),
  ]);

  const goal: Goal = GOAL_KEYS.find((k) => k === g) ?? profile.goal ?? "maintain";

  const [{ data }, { data: assignedData }, { data: requestData }, active] = await Promise.all([
    // The general shelf: global catalogue + own AI plans, never assigned ones.
    supabase
      .from("meal_plans")
      .select("*, items:meal_plan_items(*, food:foods(*))")
      .eq("goal", goal)
      .is("assigned_to", null)
      .order("created_at", { ascending: false }),
    // Plans the coach assigned to this user — shown regardless of goal filter.
    supabase
      .from("meal_plans")
      .select("*, items:meal_plan_items(*, food:foods(*))")
      .eq("assigned_to", userId)
      .order("created_at", { ascending: false }),
    supabase.from("plan_requests").select("id").eq("user_id", userId).eq("status", "pending").limit(1),
    getActiveTargets(supabase, userId, profile),
  ]);
  const plans = (data ?? []) as MealPlan[];
  const assigned = (assignedData ?? []) as MealPlan[];
  const pendingRequestId = (requestData?.[0]?.id as string | undefined) ?? null;
  const targetKcal = active?.targets.kcal ?? null;
  const format = await getFormatter();

  const all: { plan: MealPlan; kind: Kind }[] = [
    ...assigned.map((plan) => ({ plan, kind: "assigned" as const })),
    ...plans.map((plan) => ({ plan, kind: (plan.owner_id != null ? "ai" : "library") as Kind })),
  ];

  return (
    <div className="flex flex-col gap-3 lg:gap-[18px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow max-lg:hidden">{t("eyebrow")}</p>
          <h1 className="font-display text-[26px] font-bold tracking-[-0.03em] text-paper lg:mt-1 lg:text-[40px] lg:leading-[1.05] lg:tracking-[-0.035em]">
            {t("title")}
          </h1>
        </div>
        <div className="max-lg:hidden">
          <PlanTools pendingRequestId={pendingRequestId} />
        </div>
      </header>

      <nav className="flex flex-wrap items-center gap-1.5 lg:gap-2" aria-label={t("filter")}>
        {GOAL_KEYS.map((key) => (
          <Link
            key={key}
            href={`/plans?g=${key}`}
            aria-current={goal === key ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-full px-3 text-xs lg:px-3.5 lg:text-[13px] ${
              goal === key
                ? "bg-flame font-semibold text-flame-ink"
                : "border border-ink-700 text-paper-dim hover:text-paper"
            }`}
          >
            {t(`goalChip.${key}`)}
            {profile.goal === key && goal !== key ? ` · ${t("yours")}` : ""}
          </Link>
        ))}
        {targetKcal && (
          <span className="ms-1.5 text-xs text-paper-mute max-lg:hidden">
            {t("pctHint", { kcal: format.number(targetKcal) })}
          </span>
        )}
      </nav>

      {all.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-ink-700 px-6 py-14 text-center text-sm text-paper-mute">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-3 lg:gap-4">
          {all.map(({ plan, kind }) => (
            <li key={plan.id}>
              <PlanCard
                plan={plan}
                kind={kind}
                targetKcal={targetKcal}
                tag={
                  kind === "assigned"
                    ? t("tagAssigned")
                    : kind === "ai"
                      ? t("tagAi")
                      : t(`goalChip.${plan.goal}`)
                }
              />
            </li>
          ))}
        </ul>
      )}

      <div className="lg:hidden">
        <PlanTools pendingRequestId={pendingRequestId} layout="grid" />
      </div>
    </div>
  );
}
