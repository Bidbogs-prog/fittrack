import { redirect } from "next/navigation";
import { Reveal } from "@/components/motion/reveal";
import { getActiveTargets, weekStart } from "@/lib/adaptive";
import { getProfile } from "@/lib/auth";
import { entryMacros } from "@/lib/diary";
import { displayWeight, weightUnit } from "@/lib/units";
import type { DiaryEntry, WeightLog } from "@/lib/types";
import { trendDelta, weightTrend } from "@/lib/weight";
import { CalorieChart, MacroChart, WeightChart, type DayStat } from "./charts";
import { WeekReportCard } from "./week-report";
import type { WeekReport } from "./report";

export const metadata = { title: "History" };

const DAYS = 30;

function toDateString(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

function rangeLabel(from: string, to: string): string {
  const fmt = (s: string) =>
    new Date(s + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(from)} – ${fmt(to)}`;
}

export default async function HistoryPage() {
  const { supabase, userId, profile } = await getProfile();
  const active = await getActiveTargets(supabase, userId, profile);
  if (!active) redirect("/onboarding");
  const { targets } = active;

  const today = toDateString(new Date());
  const since = shiftDate(today, -(DAYS - 1));

  const [{ data: entriesData }, { data: weightData }] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("*, food:foods(*)")
      .eq("user_id", userId)
      .gte("entry_date", since)
      .lte("entry_date", today),
    supabase
      .from("weight_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("log_date", shiftDate(today, -90))
      .order("log_date"),
  ]);

  const entries = (entriesData ?? []) as DiaryEntry[];
  const byDate = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.entry_date) ?? [];
    list.push(entry);
    byDate.set(entry.entry_date, list);
  }

  const days: DayStat[] = [];
  for (let i = 0; i < DAYS; i++) {
    const date = shiftDate(since, i);
    const dayEntries = byDate.get(date);
    if (!dayEntries || dayEntries.length === 0) {
      days.push({ date, kcal: null, protein: null, carbs: null, fat: null });
      continue;
    }
    const totals = dayEntries.map(entryMacros).reduce(
      (acc, m) => ({
        kcal: acc.kcal + m.kcal,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
    days.push({ date, ...totals });
  }

  const logged = days.filter((d) => d.kcal != null);
  const avgKcal = logged.length
    ? Math.round(logged.reduce((a, d) => a + (d.kcal ?? 0), 0) / logged.length)
    : null;
  const adherent = logged.filter(
    (d) => Math.abs((d.kcal ?? 0) - targets.kcal) <= targets.kcal * 0.1
  ).length;
  const adherence = logged.length ? Math.round((adherent / logged.length) * 100) : null;

  const trendPoints = weightTrend((weightData ?? []) as WeightLog[]);
  const weightDelta = trendDelta(trendPoints, 30);

  // Last completed Monday-to-Sunday week, for the AI weekly report.
  const lastWeekStart = shiftDate(weekStart(), -7);
  const lastWeekEnd = shiftDate(lastWeekStart, 6);
  const lastWeekLogged = days.filter(
    (d) => d.date >= lastWeekStart && d.date <= lastWeekEnd && d.kcal != null
  ).length;
  const { data: savedReport } = await supabase
    .from("ai_insights")
    .select("payload")
    .eq("user_id", userId)
    .eq("scope", "week")
    .eq("period_start", lastWeekStart)
    .maybeSingle();

  // Weekly rollup: four Monday-to-Sunday weeks, newest one partial up to today.
  const thisMonday = weekStart();
  const weeks = [3, 2, 1, 0].map((offset) => {
    const start = shiftDate(thisMonday, -offset * 7);
    const end = shiftDate(start, 6);
    const visibleEnd = end < today ? end : today;
    const daysTotal =
      (Date.parse(visibleEnd + "T12:00:00") - Date.parse(start + "T12:00:00")) / 86_400_000 + 1;
    const block = days.filter((d) => d.date >= start && d.date <= visibleEnd && d.kcal != null);
    const avg = (pick: (d: DayStat) => number | null) =>
      block.length
        ? Math.round(block.reduce((a, d) => a + (pick(d) ?? 0), 0) / block.length)
        : null;
    const within = block.filter(
      (d) => Math.abs((d.kcal ?? 0) - targets.kcal) <= targets.kcal * 0.1
    ).length;
    return {
      label: rangeLabel(start, visibleEnd),
      daysLogged: block.length,
      daysTotal,
      avgKcal: avg((d) => d.kcal),
      avgProtein: avg((d) => d.protein),
      adherence: block.length ? Math.round((within / block.length) * 100) : null,
    };
  });

  const tiles = [
    {
      label: "30-day avg intake",
      value: avgKcal != null ? `${avgKcal}` : "—",
      unit: avgKcal != null ? "kcal / logged day" : "log meals to unlock",
    },
    {
      label: "Target adherence",
      value: adherence != null ? `${adherence}%` : "—",
      unit: `within ±10% of ${targets.kcal} kcal`,
    },
    {
      label: "Weight, 30 days",
      value:
        weightDelta != null
          ? `${weightDelta >= 0 ? "+" : ""}${displayWeight(weightDelta, profile.units).toFixed(1)} ${weightUnit(profile.units)}`
          : "—",
      unit: weightDelta != null ? "smoothed trend" : "log weigh-ins to unlock",
    },
    {
      label: "Days logged",
      value: `${logged.length}/${DAYS}`,
      unit: "last 30 days",
    },
  ];

  return (
    <div className="space-y-8">
      <Reveal as="header" onScroll={false}>
        <p data-reveal className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
          Last 30 days
        </p>
        <h1
          data-reveal
          className="mt-1.5 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl"
        >
          History &amp; trends
        </h1>
        <p data-reveal className="mt-2 max-w-[60ch] text-sm text-paper-dim">
          The long view: what you actually ate and where your weight is heading —
          smoothed, because single days lie.
        </p>
      </Reveal>

      {/* stat tiles */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
              {tile.label}
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-paper tabular">
              {tile.value}
            </p>
            <p className="text-[11px] text-paper-mute">{tile.unit}</p>
          </div>
        ))}
      </section>

      <WeekReportCard
        weekStart={lastWeekStart}
        label={rangeLabel(lastWeekStart, lastWeekEnd)}
        loggedDays={lastWeekLogged}
        initial={(savedReport?.payload as WeekReport | undefined) ?? null}
      />

      {/* calories */}
      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-paper">Calories vs target</h2>
        <p className="text-[11px] text-paper-mute">
          Daily intake · missing bars are unlogged days, not zeros
        </p>
        <div className="mt-4">
          {logged.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink-700 px-4 py-10 text-center text-sm text-paper-mute">
              Nothing logged in the last 30 days yet.
            </p>
          ) : (
            <CalorieChart days={days} target={targets.kcal} />
          )}
        </div>
      </section>

      {/* macros */}
      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-paper">Macros over time</h2>
        <p className="text-[11px] text-paper-mute">
          Grams per day · targets: P {targets.protein} · C {targets.carbs} · F {targets.fat}
        </p>
        <div className="mt-4">
          {logged.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink-700 px-4 py-10 text-center text-sm text-paper-mute">
              Nothing logged in the last 30 days yet.
            </p>
          ) : (
            <MacroChart days={days} />
          )}
        </div>
      </section>

      {/* weight */}
      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-paper">Weight trend</h2>
        <p className="text-[11px] text-paper-mute">Last 90 days · dots are raw weigh-ins</p>
        <div className="mt-4">
          {trendPoints.length < 2 ? (
            <p className="rounded-lg border border-dashed border-ink-700 px-4 py-10 text-center text-sm text-paper-mute">
              Log at least two weigh-ins on the dashboard to see your trend.
            </p>
          ) : (
            <WeightChart
              points={trendPoints.map((p) => ({
                ...p,
                weight: displayWeight(p.weight, profile.units),
                trend: displayWeight(p.trend, profile.units),
              }))}
              unit={weightUnit(profile.units)}
            />
          )}
        </div>
      </section>

      {/* weekly summary */}
      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-paper">Weekly summary</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-[11px] font-semibold uppercase tracking-[0.12em] text-paper-mute">
                <th className="py-2 pr-4 font-semibold">Week</th>
                <th className="py-2 pr-4 font-semibold">Logged</th>
                <th className="py-2 pr-4 font-semibold">Avg kcal</th>
                <th className="py-2 pr-4 font-semibold">Avg protein</th>
                <th className="py-2 font-semibold">Adherence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800/70">
              {weeks.map((week) => (
                <tr key={week.label}>
                  <td className="py-2.5 pr-4 text-paper">{week.label}</td>
                  <td className="py-2.5 pr-4 font-mono text-paper-dim tabular">
                    {week.daysLogged}/{week.daysTotal}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-paper-dim tabular">
                    {week.avgKcal ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-paper-dim tabular">
                    {week.avgProtein != null ? `${week.avgProtein} g` : "—"}
                  </td>
                  <td className="py-2.5 font-mono text-paper-dim tabular">
                    {week.adherence != null ? `${week.adherence}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-paper-mute">
          Adherence = logged days within ±10% of your {targets.kcal} kcal target.
        </p>
      </section>
    </div>
  );
}
