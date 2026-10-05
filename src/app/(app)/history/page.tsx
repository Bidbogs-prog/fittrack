import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { MiniDial } from "@/components/orbit/orbit";
import { dayColor } from "@/components/orbit/orbit-math";
import { getActiveTargets, weekStart } from "@/lib/adaptive";
import { getProfile } from "@/lib/auth";
import { entryMacros } from "@/lib/diary";
import { displayWeight, weightUnit } from "@/lib/units";
import type { DiaryEntry, WeightLog } from "@/lib/types";
import { trendDelta, weightTrend } from "@/lib/weight";
import { shiftDate, toDateString } from "../dashboard/day-data";
import { CalorieChart, MacroChart, WeightChart, type DayStat } from "./charts";
import { WeekReportCard } from "./week-report";
import type { WeekReport } from "./report";

export const metadata = { title: "History" };

const RANGES = { week: 7, month: 30, "90d": 90 } as const;
type Range = keyof typeof RANGES;

function rangeLabel(from: string, to: string, format: Awaited<ReturnType<typeof getFormatter>>): string {
  const f = (s: string) =>
    format.dateTime(new Date(s + "T12:00:00"), { day: "numeric", month: "short" });
  return `${f(from)} – ${f(to)}`;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const [{ supabase, userId, profile }, params, t, format] = await Promise.all([
    getProfile(),
    searchParams,
    getTranslations("history"),
    getFormatter(),
  ]);
  const range: Range = params.r === "week" || params.r === "90d" ? params.r : "month";
  const DAYS = RANGES[range];
  // Weekly reports always cover the last four weeks, whatever the range.
  const span = Math.max(DAYS, 28);

  const today = toDateString(new Date());
  const since = shiftDate(today, -(span - 1));

  // Four Monday-to-Sunday weeks for the report switcher, newest partial.
  const thisMonday = weekStart();
  const weekStarts = [3, 2, 1, 0].map((offset) => shiftDate(thisMonday, -offset * 7));

  // Everything below depends only on the profile: fetch in one round trip.
  const [active, { data: entriesData }, { data: weightData }, { data: savedReports }] = await Promise.all([
    getActiveTargets(supabase, userId, profile),
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
    supabase
      .from("ai_insights")
      .select("period_start, payload")
      .eq("user_id", userId)
      .eq("scope", "week")
      .in("period_start", weekStarts),
  ]);
  if (!active) redirect("/onboarding");
  const { targets } = active;

  const byDate = new Map<string, DiaryEntry[]>();
  for (const entry of (entriesData ?? []) as DiaryEntry[]) {
    const list = byDate.get(entry.entry_date) ?? [];
    list.push(entry);
    byDate.set(entry.entry_date, list);
  }

  const allDays: DayStat[] = [];
  for (let i = 0; i < span; i++) {
    const date = shiftDate(since, i);
    const dayEntries = byDate.get(date);
    if (!dayEntries || dayEntries.length === 0) {
      allDays.push({ date, kcal: null, protein: null, carbs: null, fat: null });
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
    allDays.push({ date, ...totals });
  }
  const days = allDays.slice(-DAYS);

  const logged = days.filter((d) => d.kcal != null);
  const avg = (pick: (d: DayStat) => number | null) =>
    logged.length ? Math.round(logged.reduce((a, d) => a + (pick(d) ?? 0), 0) / logged.length) : null;
  const avgKcal = avg((d) => d.kcal);
  const avgProtein = avg((d) => d.protein);
  const adherent = logged.filter((d) => Math.abs((d.kcal ?? 0) - targets.kcal) <= targets.kcal * 0.1).length;
  const adherence = logged.length ? Math.round((adherent / logged.length) * 100) : null;

  const trendPoints = weightTrend((weightData ?? []) as WeightLog[]);
  const weightDelta = trendDelta(trendPoints, 14);
  const lastWeight = trendPoints[trendPoints.length - 1] ?? null;
  const unit = weightUnit(profile.units);

  const weeks = weekStarts.map((start) => {
    const end = shiftDate(start, 6);
    const visibleEnd = end < today ? end : today;
    const daysTotal =
      (Date.parse(visibleEnd + "T12:00:00") - Date.parse(start + "T12:00:00")) / 86_400_000 + 1;
    const block = allDays.filter((d) => d.date >= start && d.date <= visibleEnd && d.kcal != null);
    return { start, label: rangeLabel(start, visibleEnd, format), daysLogged: block.length, daysTotal };
  });
  const reportByWeek = new Map(
    (savedReports ?? []).map((r) => [r.period_start as string, r.payload as WeekReport])
  );

  // Mon-first calendar: pad the grid so each day sits under its weekday.
  const lead = (new Date(days[0].date + "T12:00:00").getDay() + 6) % 7;
  const weekdayLetters = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(new Date(2024, 0, 1 + i), { weekday: "narrow" })
  );
  const monthTitle = format.dateTime(new Date(today + "T12:00:00"), { month: "long", year: "numeric" });

  const segmented = (
    <nav
      aria-label={t("range")}
      className="flex shrink-0 rounded-[10px] border border-ink-800 bg-ink-900 p-[3px] text-xs lg:text-[13px]"
    >
      {(Object.keys(RANGES) as Range[]).map((r) => (
        <Link
          key={r}
          href={r === "month" ? "/history" : `/history?r=${r}`}
          aria-current={range === r ? "page" : undefined}
          className={`grid min-h-8 place-items-center rounded-[7px] px-3 ${
            range === r ? "bg-ink-800 text-paper" : "text-paper-mute hover:text-paper"
          }`}
        >
          {t(`ranges.${r}`)}
        </Link>
      ))}
    </nav>
  );

  const dialSize = DAYS > 30 ? 36 : 40;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-7">
      <div className="flex min-w-0 flex-col gap-4 lg:gap-[18px]">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow max-lg:hidden">{monthTitle}</p>
            <h1 className="font-display text-[26px] font-bold tracking-[-0.03em] text-paper lg:mt-1 lg:text-[40px] lg:leading-[1.05] lg:tracking-[-0.035em]">
              <span className="lg:hidden">{t("title")}</span>
              <span className="max-lg:hidden">{t(`heading.${range}`)}</span>
            </h1>
          </div>
          {segmented}
        </header>

        {/* orbits of the range */}
        <section
          aria-label={t("daysLabel")}
          className="lg:rounded-[22px] lg:border lg:border-ink-800 lg:bg-ink-900 lg:p-5"
        >
          <div className="grid grid-cols-7 gap-x-1 gap-y-2.5 lg:gap-x-2 lg:gap-y-3.5">
            {weekdayLetters.map((l, i) => (
              <span key={i} aria-hidden className="text-center font-mono text-[10px] text-paper-mute">
                {l}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`pad-${i}`} aria-hidden />
            ))}
            {days.map((d) => {
              const ratio = d.kcal != null && targets.kcal > 0 ? d.kcal / targets.kcal : null;
              const dayNum = Number(d.date.slice(8));
              const label = `${format.dateTime(new Date(d.date + "T12:00:00"), {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}: ${d.kcal != null ? `${Math.round(d.kcal)} kcal` : t("notLogged")}`;
              return (
                <Link
                  key={d.date}
                  href={`/dashboard?d=${d.date}`}
                  aria-label={label}
                  className="btn-press flex flex-col items-center gap-1 rounded-xl py-0.5 hover:bg-ink-850"
                >
                  <span className="lg:hidden">
                    <MiniDial fraction={ratio} color={dayColor(ratio)} size={dialSize} today={d.date === today} />
                  </span>
                  <span className="max-lg:hidden">
                    <MiniDial fraction={ratio} color={dayColor(ratio)} size={56} today={d.date === today} />
                  </span>
                  <span className="font-mono text-[10px] font-medium text-paper-mute">{dayNum}</span>
                </Link>
              );
            })}
          </div>
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-paper-mute">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-flame" />
              {t("onTarget")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-flame-deep" />
              {t("over")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-paper-mute" />
              {t("under")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full border border-ink-600" />
              {t("notLogged")}
            </span>
            <span className="max-lg:hidden">{t("openDay")}</span>
          </p>
        </section>

        <section className="rounded-[20px] border border-ink-800 bg-ink-900 p-3.5 lg:rounded-[22px] lg:p-[18px]">
          <h2 className="font-display text-[15px] font-semibold text-paper">
            {t("calories", { days: DAYS })}
          </h2>
          <div className="mt-3">
            {logged.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-700 px-4 py-10 text-center text-sm text-paper-mute">
                {t("nothingLogged")}
              </p>
            ) : (
              <CalorieChart days={days} target={targets.kcal} />
            )}
          </div>
        </section>

        <details className="group rounded-[20px] border border-ink-800 bg-ink-900 lg:rounded-[22px]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 lg:px-[18px] [&::-webkit-details-marker]:hidden">
            <span className="font-display text-[15px] font-semibold text-paper">{t("macros")}</span>
            <span className="text-xs text-paper-mute">
              P {targets.protein} · C {targets.carbs} · F {targets.fat} g
            </span>
          </summary>
          <div className="px-3.5 pb-4 lg:px-[18px]">
            {logged.length === 0 ? (
              <p className="py-6 text-center text-sm text-paper-mute">{t("nothingLogged")}</p>
            ) : (
              <MacroChart days={days} />
            )}
          </div>
        </details>
      </div>

      <div className="flex flex-col gap-3.5">
        <section className="rounded-[20px] border border-ink-800 bg-ink-900 p-3.5 lg:rounded-[22px] lg:p-[18px]">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[15px] font-semibold text-paper">{t("weight")}</h2>
            {weightDelta != null && (
              <span className={`font-mono text-xs font-medium tabular ${weightDelta <= 0 ? "text-fibre" : "text-paper-dim"}`}>
                {weightDelta >= 0 ? "+" : "−"}
                {displayWeight(Math.abs(weightDelta), profile.units).toFixed(1)} {unit} / 14 d
              </span>
            )}
          </div>
          <p className="mt-1.5 font-mono text-[28px] font-semibold tracking-[-0.03em] text-paper tabular lg:text-[34px]">
            {lastWeight ? displayWeight(lastWeight.trend, profile.units).toFixed(1) : "—"}
            <span className="text-sm font-normal text-paper-mute"> {unit}</span>
          </p>
          <div className="mt-2">
            {trendPoints.length < 2 ? (
              <p className="rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-paper-mute">
                {t("weightEmpty")}
              </p>
            ) : (
              <WeightChart
                points={trendPoints.map((p) => ({
                  ...p,
                  weight: displayWeight(p.weight, profile.units),
                  trend: displayWeight(p.trend, profile.units),
                }))}
                unit={unit}
              />
            )}
          </div>
          <Link
            href="/dashboard"
            className="btn-tint btn-press mt-3 inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-medium"
          >
            {t("logWeight")}
          </Link>
        </section>

        <WeekReportCard
          weeks={weeks.map((w) => ({
            weekStart: w.start,
            label: w.label,
            loggedDays: w.daysLogged,
            daysTotal: w.daysTotal,
            initial: reportByWeek.get(w.start) ?? null,
          }))}
        />

        <dl className="grid grid-cols-2 gap-3 rounded-[20px] border border-ink-800 bg-ink-900 p-3.5 lg:rounded-[22px] lg:p-[18px]">
          <div>
            <dt className="text-[11px] text-paper-mute">{t("avgKcal")}</dt>
            <dd className="font-mono text-lg font-medium text-paper tabular">
              {avgKcal != null ? format.number(avgKcal) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-paper-mute">{t("adherence")}</dt>
            <dd className="font-mono text-lg font-medium text-flame tabular">
              {adherence != null ? `${adherence}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-paper-mute">{t("avgProtein")}</dt>
            <dd className="font-mono text-lg font-medium text-paper tabular">
              {avgProtein != null ? `${avgProtein} g` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-paper-mute">{t("export")}</dt>
            <dd>
              <a
                href="/api/export?what=diary&format=csv"
                download
                className="inline-flex min-h-8 items-center gap-1 text-sm text-paper-dim hover:text-flame"
              >
                CSV <DownloadSimple weight="bold" className="size-3.5" />
              </a>
            </dd>
          </div>
          <p className="col-span-2 text-[11px] text-paper-mute">
            {t("adherenceHint", { days: logged.length, total: DAYS, target: format.number(targets.kcal) })}
          </p>
        </dl>
      </div>
    </div>
  );
}
