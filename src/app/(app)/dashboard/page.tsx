import { CaretLeft, CaretRight, Trash } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalorieRing, MacroBars, MacroInline } from "@/components/macros";
import { getProfile } from "@/lib/auth";
import { GOALS, calcTargets, macrosForPortion, sumMacros } from "@/lib/nutrition";
import { MEAL_TYPES, type DiaryEntry, type Food } from "@/lib/types";
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

  const [{ data: entriesData }, { data: foodsData }] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("*, food:foods(*)")
      .eq("user_id", userId)
      .eq("entry_date", date)
      .order("created_at"),
    supabase.from("foods").select("*").order("name"),
  ]);

  const entries = (entriesData ?? []) as DiaryEntry[];
  const foods = (foodsData ?? []) as Food[];

  const eaten = sumMacros(entries.map((e) => macrosForPortion(e.food, e.grams)));
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
            {GOALS[targets.goal].label} · {isToday ? "today" : dateLabel}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
            {isToday ? `Fuel the work, ${firstName}.` : dateLabel}
          </h1>
        </div>
        <nav className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1">
          <Link
            href={`/dashboard?d=${shiftDate(date, -1)}`}
            aria-label="Previous day"
            className="btn-press rounded-md p-2 text-paper-mute hover:bg-ink-800 hover:text-paper"
          >
            <CaretLeft weight="bold" className="size-4" />
          </Link>
          <Link
            href="/dashboard"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              isToday ? "bg-lime text-lime-ink" : "text-paper-dim hover:text-paper"
            }`}
          >
            Today
          </Link>
          <Link
            href={`/dashboard?d=${shiftDate(date, 1)}`}
            aria-label="Next day"
            className="btn-press rounded-md p-2 text-paper-mute hover:bg-ink-800 hover:text-paper"
          >
            <CaretRight weight="bold" className="size-4" />
          </Link>
        </nav>
      </header>

      {/* energy hero */}
      <section className="reveal grid gap-6 rounded-2xl border border-ink-800 bg-ink-900/60 p-6 md:grid-cols-[auto_1fr] md:items-center md:gap-10 md:p-8">
        <CalorieRing eaten={eaten.kcal} target={targets.kcal} />
        <div>
          <p className="font-display text-xl font-semibold tracking-tight text-paper">
            {remaining >= 0 ? (
              <>
                <span className="font-mono text-lime tabular">{remaining.toLocaleString()}</span> kcal
                left {isToday ? "today" : "that day"}
              </>
            ) : (
              <>
                <span className="font-mono text-danger tabular">
                  {Math.abs(remaining).toLocaleString()}
                </span>{" "}
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
              <div key={label} className="px-4 py-3 first:pl-0">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
                  {label}
                </dt>
                <dd className="mt-0.5 font-mono text-xl font-semibold tracking-tight text-paper tabular">
                  {value.toLocaleString()}
                </dd>
                <dd className="text-[11px] text-paper-mute">{sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <MacroBars eaten={eaten} targets={targets} />

      {/* meals */}
      <section className="grid gap-5 lg:grid-cols-2">
        {MEAL_TYPES.map((meal, i) => {
          const mealEntries = entries.filter((e) => e.meal === meal);
          const mealTotal = sumMacros(mealEntries.map((e) => macrosForPortion(e.food, e.grams)));
          return (
            <article
              key={meal}
              className="reveal rounded-2xl border border-ink-800 bg-ink-900/60"
              style={{ "--i": i + 1 } as React.CSSProperties}
            >
              <header className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
                <div>
                  <h2 className="font-display text-base font-semibold capitalize text-paper">
                    {meal}
                  </h2>
                  <MacroInline macros={mealTotal} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-paper-dim tabular">
                    {Math.round(mealTotal.kcal)} kcal
                  </span>
                  <AddFoodDialog foods={foods} meal={meal} entryDate={date} />
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
                          <p className="text-[11px] text-paper-mute">
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
                            className="btn-press rounded-md p-1.5 text-paper-mute opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger focus:opacity-100 group-hover:opacity-100"
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
