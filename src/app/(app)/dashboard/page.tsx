import { CaretLeft, CaretRight, CopySimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AiInsights } from "@/components/ai-insights";
import type { DayInsights } from "./insights";
import { CalorieRing, MacroBars, MacroInline } from "@/components/macros";
import { MicroPanel } from "@/components/micros";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { getActiveTargets } from "@/lib/adaptive";
import { getProfile } from "@/lib/auth";
import { entryMacros, entryMicros } from "@/lib/diary";
import { GOALS, calcWaterTargetMl, sumMacros, sumMicros } from "@/lib/nutrition";
import { calcStreaks } from "@/lib/streak";
import { displayWeight, weightUnit } from "@/lib/units";
import {
  MEAL_TYPES,
  type DiaryEntry,
  type ExerciseLog,
  type MealType,
  type WeightLog,
} from "@/lib/types";
import { trendDelta, weightTrend } from "@/lib/weight";
import { ActivityCard } from "./activity-card";
import { AddFoodDialog } from "./add-food-dialog";
import { copyDiaryEntries } from "./actions";
import { EntryRow } from "./entry-row";
import { Habits } from "./habits";
import { OfflineSync } from "./offline-sync";
import { SaveMealButton } from "./save-meal-button";
import { WeightCard } from "./weight-card";

export const metadata = { title: "Today" };

function toDateString(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const [{ supabase, userId, profile }, params] = await Promise.all([
    getProfile(),
    searchParams,
  ]);

  const active = await getActiveTargets(supabase, userId, profile);
  if (!active) redirect("/onboarding");
  const { targets, adaptive } = active;

  const today = toDateString(new Date());
  const date = params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : today;

  const yesterday = shiftDate(date, -1);
  const [{ data: entriesData }, { data: weightData }, { data: yesterdayData }, { data: savedInsight }] =
    await Promise.all([
      supabase
        .from("diary_entries")
        .select("*, food:foods(*)")
        .eq("user_id", userId)
        .eq("entry_date", date)
        .order("created_at"),
      supabase
        .from("weight_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", shiftDate(today, -120))
        .order("log_date"),
      supabase
        .from("diary_entries")
        .select("meal")
        .eq("user_id", userId)
        .eq("entry_date", yesterday),
      supabase
        .from("ai_insights")
        .select("payload, updated_at")
        .eq("user_id", userId)
        .eq("scope", "day")
        .eq("period_start", date)
        .maybeSingle(),
    ]);

  const [{ data: streakData }, { data: waterData }, { data: exerciseData }, { data: stepData }] =
    await Promise.all([
      supabase
        .from("diary_entries")
        .select("entry_date")
        .eq("user_id", userId)
        .gte("entry_date", shiftDate(today, -219))
        .lte("entry_date", today),
      supabase
        .from("water_logs")
        .select("ml")
        .eq("user_id", userId)
        .eq("log_date", date)
        .maybeSingle(),
      supabase
        .from("exercise_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", date)
        .order("created_at"),
      supabase
        .from("step_logs")
        .select("steps")
        .eq("user_id", userId)
        .eq("log_date", date)
        .maybeSingle(),
    ]);
  const streaks = calcStreaks(
    (streakData ?? []).map((r) => r.entry_date as string),
    today
  );

  const entries = (entriesData ?? []) as DiaryEntry[];
  const trendPoints = weightTrend((weightData ?? []) as WeightLog[]);
  const yesterdayMeals = new Set((yesterdayData ?? []).map((r) => r.meal as MealType));

  const eaten = sumMacros(entries.map(entryMacros));
  const microTotals = sumMicros(entries.map(entryMicros));

  // Exercise raises the day's calorie target — but only for formula
  // targets. Adaptive TDEE already measures total burn, so crediting
  // workouts on top would double-count them.
  const exercises = (exerciseData ?? []) as ExerciseLog[];
  const burned = exercises.reduce((sum, e) => sum + e.kcal, 0);
  const kcalTarget = adaptive ? targets.kcal : targets.kcal + burned;
  const remaining = Math.round(kcalTarget - eaten.kcal);
  const isToday = date === today;
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const firstName = profile.full_name?.split(" ")[0] ?? "athlete";
  const weekday = new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" });

  return (
    <div className="space-y-8">
      {/* header */}
      <Reveal as="header" className="flex flex-wrap items-end justify-between gap-4" onScroll={false}>
        <div data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
            {GOALS[targets.goal].label} · {isToday ? "today" : dateLabel}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
            {isToday ? `Fuel the work, ${firstName}.` : dateLabel}
          </h1>
        </div>
        <nav data-reveal className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1">
          <Link
            href={`/dashboard?d=${shiftDate(date, -1)}`}
            aria-label="Previous day"
            className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-ink-800 hover:text-paper pointer-coarse:p-3"
          >
            <CaretLeft weight="bold" className="size-4" />
          </Link>
          <Link
            href="/dashboard"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold pointer-coarse:py-2.5 ${
              isToday ? "bg-lime text-lime-ink" : "text-paper-dim hover:text-paper"
            }`}
          >
            Today
          </Link>
          <Link
            href={`/dashboard?d=${shiftDate(date, 1)}`}
            aria-label="Next day"
            className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-ink-800 hover:text-paper pointer-coarse:p-3"
          >
            <CaretRight weight="bold" className="size-4" />
          </Link>
        </nav>
      </Reveal>

      <OfflineSync />

      {/* energy hero */}
      <Reveal
        as="section"
        onScroll={false}
        delay={0.1}
        className="grid gap-6 rounded-2xl border border-ink-800 bg-ink-900/60 p-6 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-10 lg:p-8"
      >
        <CalorieRing eaten={eaten.kcal} target={kcalTarget} />
        <div>
          <p className="font-display text-xl font-semibold tracking-tight text-paper">
            {remaining >= 0 ? (
              <>
                <CountUp value={remaining} className="font-mono text-lime tabular" /> kcal
                left {isToday ? "today" : "that day"}
              </>
            ) : (
              <>
                <CountUp value={Math.abs(remaining)} className="font-mono text-danger tabular" />{" "}
                kcal over target
              </>
            )}
          </p>
          <dl className="mt-4 grid grid-cols-3 divide-x divide-ink-700 border-y border-ink-700">
            {(
              [
                ["BMR", targets.bmr, "resting burn"],
                ["TDEE", targets.tdee, adaptive ? "adaptive burn" : "daily burn"],
                [
                  "Target",
                  kcalTarget,
                  burned > 0 && !adaptive
                    ? `incl. +${burned} exercise`
                    : GOALS[targets.goal].label.toLowerCase(),
                ],
              ] as const
            ).map(([label, value, sub]) => (
              <div key={label} className="px-3 py-3 first:pl-0 sm:px-4">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
                  {label}
                </dt>
                <dd className="mt-0.5 font-mono text-lg font-semibold tracking-tight text-paper tabular sm:text-xl">
                  <CountUp value={value} />
                </dd>
                <dd className="text-[11px] text-paper-mute">{sub}</dd>
              </div>
            ))}
          </dl>
          {adaptive && (
            <p className="mt-3 text-[11px] leading-relaxed text-paper-mute">
              Adaptive target: over {adaptive.spanDays} days you averaged{" "}
              <span className="font-mono text-paper-dim tabular">{adaptive.intakeAvg}</span> kcal/day
              while your trend weight {adaptive.weightDeltaKg <= 0 ? "dropped" : "rose"}{" "}
              <span className="font-mono text-paper-dim tabular">
                {displayWeight(Math.abs(adaptive.weightDeltaKg), profile.units).toFixed(1)}
              </span>{" "}
              {weightUnit(profile.units)}, so your measured burn is{" "}
              <span className="font-mono text-paper-dim tabular">{adaptive.tdee}</span> kcal.
              Recalibrates every Monday from your diary and weigh-ins.
            </p>
          )}
        </div>
      </Reveal>

      <Habits
        streaks={streaks}
        waterMl={waterData?.ml ?? 0}
        waterTarget={calcWaterTargetMl(profile.weight_kg)}
        date={date}
        isToday={isToday}
        fastingStart={profile.eating_window_start}
        fastingEnd={profile.eating_window_end}
      />

      <WeightCard
        points={trendPoints}
        delta={trendDelta(trendPoints)}
        date={date}
        isToday={isToday}
        defaultWeight={profile.weight_kg}
        units={profile.units}
      />

      <ActivityCard
        date={date}
        exercises={exercises}
        steps={stepData?.steps ?? null}
        adaptive={adaptive != null}
      />

      <AiInsights
        key={date}
        date={date}
        hasEntries={entries.length > 0}
        initial={(savedInsight?.payload as DayInsights | undefined) ?? null}
        generatedAt={savedInsight?.updated_at ?? null}
      />

      <MacroBars eaten={eaten} targets={targets} />

      <MicroPanel totals={microTotals} />

      {/* meals */}
      {entries.length === 0 && yesterdayMeals.size > 0 && (
        <form action={copyDiaryEntries}>
          <input type="hidden" name="from_date" value={yesterday} />
          <input type="hidden" name="to_date" value={date} />
          <button
            type="submit"
            className="btn-press inline-flex items-center gap-2 rounded-lg border border-ink-700 px-4 py-2.5 text-xs font-semibold text-paper-dim transition-colors hover:border-lime/50 hover:text-lime"
          >
            <CopySimple weight="bold" className="size-4" />
            Copy everything from yesterday
          </button>
        </form>
      )}
      <Reveal as="section" className="grid gap-5 xl:grid-cols-2" stagger={0.1} start="top 90%">
        {MEAL_TYPES.map((meal) => {
          const mealEntries = entries.filter((e) => e.meal === meal);
          const mealTotal = sumMacros(mealEntries.map(entryMacros));
          return (
            <article
              key={meal}
              data-reveal
              className="rounded-2xl border border-ink-800 bg-ink-900/60"
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-800 px-5 py-4">
                <div className="min-w-0">
                  <h2 className="font-display text-base font-semibold capitalize text-paper">
                    {meal}
                  </h2>
                  <MacroInline macros={mealTotal} />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm text-paper-dim tabular">
                    {Math.round(mealTotal.kcal)} kcal
                  </span>
                  {mealEntries.length > 0 && (
                    <SaveMealButton
                      meal={meal}
                      date={date}
                      defaultName={`${weekday} ${meal}`}
                    />
                  )}
                  {mealEntries.length === 0 && yesterdayMeals.has(meal) && (
                    <form action={copyDiaryEntries}>
                      <input type="hidden" name="from_date" value={yesterday} />
                      <input type="hidden" name="to_date" value={date} />
                      <input type="hidden" name="meal" value={meal} />
                      <button
                        type="submit"
                        title={`Copy yesterday's ${meal}`}
                        aria-label={`Copy yesterday's ${meal}`}
                        className="btn-press rounded-lg border border-ink-700 p-2 text-paper-mute transition-colors hover:border-lime/50 hover:text-lime"
                      >
                        <CopySimple weight="bold" className="size-3.5" />
                      </button>
                    </form>
                  )}
                  <AddFoodDialog meal={meal} entryDate={date} />
                </div>
              </header>
              {mealEntries.length === 0 ? (
                <p className="px-5 py-7 text-center text-sm text-paper-mute">
                  Nothing logged yet.
                </p>
              ) : (
                <ul className="divide-y divide-ink-800/70">
                  {mealEntries.map((entry) => (
                    <li key={entry.id}>
                      <EntryRow entry={entry} />
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </Reveal>
    </div>
  );
}
