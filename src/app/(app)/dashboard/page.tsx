import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { AiInsights } from "@/components/ai-insights";
import { MacroTiles } from "@/components/macros";
import { ComposerChip, Composer } from "@/components/orbit/composer";
import { Greeting } from "@/components/orbit/greeting";
import { LogProvider } from "@/components/orbit/log-provider";
import { Thread, type ThreadNudge } from "@/components/orbit/thread";
import { TodayOrbit } from "@/components/orbit/today-orbit";
import { WaterChip } from "@/components/orbit/water-chip";
import { copyDiaryEntries } from "./actions";
import { CalendarPicker } from "./calendar-picker";
import { getDayData, parseDateParam, ringFractions, shiftDate, toDateString } from "./day-data";
import { FastingStatus } from "./fasting-status";
import { OfflineSync } from "./offline-sync";
import { DayRail } from "./rail";

export const metadata = { title: "Today" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const params = await searchParams;
  const date = parseDateParam(params.d, toDateString(new Date()));
  const [data, t, tg, format] = await Promise.all([
    getDayData(date),
    getTranslations("today"),
    getTranslations("goals"),
    getFormatter(),
  ]);
  const { profile, targets, eaten, entries, isToday, remaining, kcalTarget, burned, adaptive } = data;

  const day = new Date(date + "T12:00:00");
  const dateLabel = format.dateTime(day, { weekday: "long", day: "numeric", month: "long" });
  const weekdayShort = format.dateTime(day, { weekday: "short" });
  const weekday = format.dateTime(day, { weekday: "long" });
  const firstName = profile.full_name?.split(" ")[0] ?? t("athlete");
  const rings = ringFractions(data);
  const proteinGap = Math.round(targets.protein - eaten.protein);
  const windowEnd = profile.eating_window_end?.slice(0, 5) ?? null;

  // Deterministic coach nudges — no model call; the coach page does the talking.
  const nudges: ThreadNudge[] = [];
  if (isToday) {
    if (entries.length === 0) {
      nudges.push({ key: "empty", minutes: null, body: t.rich("nudgeEmpty", { b: (c) => <b>{c}</b> }) });
    } else if (proteinGap >= 15 && remaining > 0) {
      const question = t("ideasQuestion", { protein: proteinGap, kcal: remaining });
      nudges.push({
        key: "protein",
        minutes: null,
        body: windowEnd
          ? t.rich("nudgeProteinWindow", { end: windowEnd, gap: proteinGap, b: (c) => <b>{c}</b> })
          : t.rich("nudgeProtein", { gap: proteinGap, kcal: remaining, b: (c) => <b>{c}</b> }),
        cta: { label: t("seeIdeas"), href: `/coach?c=new&q=${encodeURIComponent(question)}` },
      });
    } else if (remaining < -150) {
      nudges.push({
        key: "over",
        minutes: null,
        body: t.rich("nudgeOver", { kcal: Math.abs(remaining), b: (c) => <b>{c}</b> }),
        cta: {
          label: t("talkItThrough"),
          href: `/coach?c=new&q=${encodeURIComponent(t("overQuestion", { kcal: Math.abs(remaining) }))}`,
        },
      });
    } else if (proteinGap < 15 && Math.abs(remaining) <= 150) {
      nudges.push({ key: "ontarget", minutes: null, body: t.rich("nudgeOnTarget", { b: (c) => <b>{c}</b> }) });
    }
  }

  const ideasQuestion = t("ideasQuestion", {
    protein: Math.max(0, proteinGap),
    kcal: Math.max(0, remaining),
  });

  const chips = (
    <>
      <ComposerChip href={`/coach?c=new&q=${encodeURIComponent(ideasQuestion)}`}>{t("chipIdeas")}</ComposerChip>
      {data.yesterdayHasEntries && (
        <form action={copyDiaryEntries} className="contents">
          <input type="hidden" name="from_date" value={data.yesterday} />
          <input type="hidden" name="to_date" value={date} />
          <ComposerChip type="submit">{t("chipYesterday")}</ComposerChip>
        </form>
      )}
      <WaterChip date={date} />
      <ComposerChip href="/coach">{t("chipCoach")}</ComposerChip>
    </>
  );

  const stats = [
    [t("bmr"), targets.bmr, false],
    [t("tdee"), targets.tdee, false],
    [t("target"), kcalTarget, true],
  ] as const;

  const dayNav = (
    <nav
      aria-label={t("dayNav")}
      className="flex shrink-0 items-center gap-0.5 rounded-[10px] border border-ink-700 bg-ink-900 p-[3px] text-[13px]"
    >
      <Link
        href={`/dashboard?d=${shiftDate(date, -1)}`}
        aria-label={t("prevDay")}
        className="btn-press grid size-9 place-items-center rounded-[7px] text-paper-mute hover:text-paper lg:size-8"
      >
        <CaretLeft weight="bold" className="size-3.5 rtl:-scale-x-100" />
      </Link>
      <Link
        href="/dashboard"
        aria-current={isToday ? "date" : undefined}
        className={`grid min-h-9 place-items-center rounded-[7px] px-2.5 font-semibold capitalize lg:min-h-8 ${
          isToday ? "bg-flame text-flame-ink" : "text-paper-dim hover:text-paper"
        }`}
      >
        {isToday ? weekdayShort : t("backToToday")}
      </Link>
      <Link
        href={`/dashboard?d=${shiftDate(date, 1)}`}
        aria-label={t("nextDay")}
        className="btn-press grid size-9 place-items-center rounded-[7px] text-paper-mute hover:text-paper lg:size-8"
      >
        <CaretRight weight="bold" className="size-3.5 rtl:-scale-x-100" />
      </Link>
      <CalendarPicker selected={date} today={data.today} />
    </nav>
  );

  const eyebrow = `${tg(targets.goal)} · ${isToday ? t("today") : dateLabel}`;
  const heading = isToday ? (
    <Greeting
      name={firstName}
      className="mt-1 font-display text-[26px] leading-[1.1] font-bold tracking-[-0.03em] text-paper lg:text-[40px] lg:leading-[1.05] lg:tracking-[-0.035em]"
    />
  ) : (
    <h1 className="mt-1 font-display text-[26px] leading-[1.1] font-bold tracking-[-0.03em] text-paper capitalize lg:text-[40px] lg:tracking-[-0.035em]">
      {weekday}
    </h1>
  );

  return (
    <LogProvider key={date} entryDate={date} isToday={isToday} entryIds={entries.map((e) => e.id)}>
      <div className="max-lg:px-[18px] max-lg:pt-2 max-lg:pb-44 lg:grid lg:min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col">
          {/* header: stacked on mobile, dial + text side by side on desktop */}
          <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-9 lg:border-b lg:border-ink-800 lg:bg-[radial-gradient(500px_300px_at_20%_50%,rgba(255,157,59,0.06),transparent_70%)] lg:px-9 lg:pt-7 lg:pb-6">
            <div className="flex items-end justify-between gap-3 lg:hidden">
              <div className="min-w-0">
                <p className="eyebrow truncate">{eyebrow}</p>
                {heading}
              </div>
              {dayNav}
            </div>

            <div className="self-center lg:order-first">
              <TodayOrbit
                entries={entries.map((e) => ({
                  id: e.id,
                  meal: e.meal,
                  entry_date: e.entry_date,
                  created_at: e.created_at ?? null,
                }))}
                rings={rings}
                kcalLeft={remaining}
                windowStart={profile.eating_window_start}
                windowEnd={profile.eating_window_end}
                showHint
              />
            </div>

            <div className="flex min-w-0 flex-col gap-3 max-lg:hidden">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow">{`${tg(targets.goal)} · ${dateLabel}`}</p>
                  {heading}
                </div>
                {dayNav}
              </div>
              <dl className="grid w-max grid-cols-3 border-y border-ink-700">
                {stats.map(([label, value, accent], i) => (
                  <div
                    key={label}
                    className={`py-2.5 ${i === 0 ? "pe-5" : i === 1 ? "px-5" : "ps-5"} ${i < 2 ? "border-e border-ink-700" : ""}`}
                  >
                    <dt className="text-[10px] font-semibold tracking-[0.14em] text-paper-mute uppercase">{label}</dt>
                    <dd className={`font-mono text-xl font-medium tabular ${accent ? "text-flame" : "text-paper"}`}>
                      {format.number(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              {burned > 0 && !adaptive && (
                <p className="text-xs text-paper-mute">{t("burnedNote", { kcal: burned })}</p>
              )}
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-paper-mute">
                {t("hintDesktop")}
                <kbd className="rounded-[5px] border border-ink-700 px-1.5 py-px font-mono text-[11px] text-paper-dim">
                  Space
                </kbd>
                {isToday && profile.eating_window_start && profile.eating_window_end && (
                  <FastingStatus start={profile.eating_window_start} end={profile.eating_window_end} />
                )}
              </p>
            </div>

            <div className="lg:hidden">
              <MacroTiles eaten={eaten} targets={targets} />
            </div>
          </section>

          <OfflineSync />

          <div className="mt-4 flex flex-1 flex-col gap-4 lg:mt-0 lg:px-9 lg:pt-5">
            <Thread
              entries={entries}
              nudges={nudges}
              proteinReached={eaten.protein >= targets.protein}
              kcalLeft={remaining}
              weekday={weekday}
            />
            <AiInsights
              key={date}
              date={date}
              hasEntries={entries.length > 0}
              initial={data.savedInsight?.payload ?? null}
              generatedAt={data.savedInsight?.updatedAt ?? null}
            />
          </div>

          <div className="lg:px-9">
            <Composer chips={chips} />
          </div>
        </div>

        <DayRail data={data} />
      </div>
    </LogProvider>
  );
}
