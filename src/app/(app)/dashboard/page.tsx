import { CaretLeft, CaretRight, Trash } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalorieRing, MacroBars, MacroInline } from "@/components/macros";
import { MicroPanel } from "@/components/micros";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { getProfile } from "@/lib/auth";
import {
  GOALS,
  calcTargets,
  macrosForPortion,
  microsForPortion,
  sumMacros,
  sumMicros,
} from "@/lib/nutrition";
import { MEAL_TYPES, type DiaryEntry } from "@/lib/types";
import { AddFoodDialog } from "./add-food-dialog";
import { deleteDiaryEntry } from "./actions";

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

  const targets = calcTargets(profile);
  if (!targets) redirect("/onboarding");

  const today = toDateString(new Date());
  const date = params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : today;

  const { data: entriesData } = await supabase
    .from("diary_entries")
    .select("*, food:foods(*)")
    .eq("user_id", userId)
    .eq("entry_date", date)
    .order("created_at");

  const entries = (entriesData ?? []) as DiaryEntry[];

  const eaten = sumMacros(entries.map((e) => macrosForPortion(e.food, e.grams)));
  const microTotals = sumMicros(entries.map((e) => microsForPortion(e.food, e.grams)));
  const remaining = Math.round(targets.kcal - eaten.kcal);
  const isToday = date === today;
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const firstName = profile.full_name?.split(" ")[0] ?? "athlete";

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

      {/* energy hero */}
      <Reveal
        as="section"
        onScroll={false}
        delay={0.1}
        className="grid gap-6 rounded-2xl border border-ink-800 bg-ink-900/60 p-6 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-10 lg:p-8"
      >
        <CalorieRing eaten={eaten.kcal} target={targets.kcal} />
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
                ["TDEE", targets.tdee, "daily burn"],
                ["Target", targets.kcal, GOALS[targets.goal].label.toLowerCase()],
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
        </div>
      </Reveal>

      <MacroBars eaten={eaten} targets={targets} />

      <MicroPanel totals={microTotals} />

      {/* meals */}
      <Reveal as="section" className="grid gap-5 xl:grid-cols-2" stagger={0.1} start="top 90%">
        {MEAL_TYPES.map((meal) => {
          const mealEntries = entries.filter((e) => e.meal === meal);
          const mealTotal = sumMacros(mealEntries.map((e) => macrosForPortion(e.food, e.grams)));
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
                  <AddFoodDialog meal={meal} entryDate={date} />
                </div>
              </header>
              {mealEntries.length === 0 ? (
                <p className="px-5 py-7 text-center text-sm text-paper-mute">
                  Nothing logged yet.
                </p>
              ) : (
                <ul className="divide-y divide-ink-800/70">
                  {mealEntries.map((entry) => {
                    const m = macrosForPortion(entry.food, entry.grams);
                    return (
                      <li key={entry.id} className="group flex items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-paper">
                            {entry.food.name}
                          </p>
                          <p className="truncate text-[11px] text-paper-mute">
                            {entry.grams} g · P {m.protein.toFixed(1)} · C {m.carbs.toFixed(1)} · F{" "}
                            {m.fat.toFixed(1)} · Fb {m.fibre.toFixed(1)}
                          </p>
                        </div>
                        <span className="font-mono text-sm text-paper-dim tabular">
                          {Math.round(m.kcal)}
                        </span>
                        <form action={deleteDiaryEntry}>
                          <input type="hidden" name="id" value={entry.id} />
                          <button
                            type="submit"
                            aria-label={`Remove ${entry.food.name}`}
                            className="btn-press rounded-md p-2.5 text-paper-mute transition-opacity hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 pointer-coarse:text-danger/80 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
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
      </Reveal>
    </div>
  );
}
