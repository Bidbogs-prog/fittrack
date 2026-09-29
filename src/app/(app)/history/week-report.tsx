"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowClockwise, CaretLeft, CaretRight, Notebook } from "@phosphor-icons/react";
import { Reveal } from "@/components/motion/reveal";
import { generateWeekReport, type WeekReport } from "./report";

const KIND_CHIP: Record<WeekReport["highlights"][number]["kind"], string> = {
  win: "bg-flame/10 text-flame ring-flame/25",
  watch: "bg-danger/10 text-danger ring-danger/25",
  tip: "bg-carbs/10 text-carbs ring-carbs/25",
};

export interface WeekOption {
  weekStart: string;
  label: string;
  loggedDays: number;
  /** Days of the week that have happened so far; < 7 = week in progress. */
  daysTotal: number;
  initial: WeekReport | null;
}

/**
 * Weekly AI report card with a week switcher (the current week, possibly
 * partial, plus the three before it). Reports persist in ai_insights and
 * hydrate via `initial`; generation is on demand per week.
 */
export function WeekReportCard({ weeks }: { weeks: WeekOption[] }) {
  const [index, setIndex] = useState(weeks.length - 1);
  const [reports, setReports] = useState<Record<string, WeekReport | null>>(() =>
    Object.fromEntries(weeks.map((w) => [w.weekStart, w.initial]))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const week = weeks[index];
  const report = reports[week.weekStart] ?? null;
  const partial = week.daysTotal < 7;
  const enoughData = week.loggedDays >= 3;

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = await generateWeekReport(week.weekStart);
      if (res.error) setError(res.error);
      else setReports((prev) => ({ ...prev, [week.weekStart]: res.data }));
    });
  };

  const move = (delta: number) => {
    setIndex((i) => Math.min(weeks.length - 1, Math.max(0, i + delta)));
    setError(null);
  };

  return (
    <Reveal as="section" className="nudge rounded-[22px]">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 lg:px-5">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-flame uppercase">
              <Notebook weight="fill" className="me-1.5 inline size-3.5 align-[-2px]" />
              Week report · {week.label}
            </h2>
            <p className="mt-0.5 text-[11px] text-paper-mute">
              {week.loggedDays}/{week.daysTotal} days logged
              {partial && " · in progress"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => move(-1)}
            disabled={isPending || index === 0}
            aria-label="Previous week"
            className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-ink-800 hover:text-paper disabled:opacity-30"
          >
            <CaretLeft weight="bold" className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            disabled={isPending || index === weeks.length - 1}
            aria-label="Next week"
            className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-ink-800 hover:text-paper disabled:opacity-30"
          >
            <CaretRight weight="bold" className="size-4" />
          </button>
          {report && (
            <button
              type="button"
              onClick={run}
              disabled={isPending}
              aria-label="Regenerate report"
              className="btn-press ms-1 rounded-md p-2.5 text-paper-mute hover:bg-ink-800 hover:text-paper disabled:opacity-40"
            >
              <ArrowClockwise className={`size-4 ${isPending ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </header>

      <div className="px-4 pt-2 pb-4 lg:px-5">
        {isPending ? (
          <div className="space-y-2.5 py-1" aria-live="polite" aria-busy="true">
            <p className="text-xs text-paper-mute">Reviewing your week…</p>
            {[88, 100, 70].map((w, i) => (
              <div
                key={i}
                className="h-3 animate-pulse rounded bg-ink-700"
                style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        ) : report ? (
          <div className="space-y-4">
            <p className="text-[15px] leading-relaxed text-paper">{report.summary}</p>
            <Link
              href={`/coach?c=new&q=${encodeURIComponent(`Let's go through my week report for ${week.label}: ${report.summary}`)}`}
              className="inline-flex min-h-8 items-center text-[13px] font-medium text-flame hover:text-flame-glow"
            >
              Discuss with your coach <span aria-hidden className="ms-1 rtl:-scale-x-100">→</span>
            </Link>
            <ul className="space-y-3">
              {report.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset ${KIND_CHIP[h.kind]}`}
                  >
                    {h.tag}
                  </span>
                  <p className="text-sm leading-relaxed text-paper-dim">{h.text}</p>
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-ink-850 px-3.5 py-2.5 text-sm text-paper">
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-flame">
                {partial ? "Rest of week" : "Next week"}
              </span>
              {report.focus}
            </p>
            <p className="border-t border-ink-800 pt-3 text-[11px] text-paper-mute">
              Generated by Gemini — general guidance, not medical advice.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p
              role={error ? "alert" : undefined}
              className={`max-w-md text-sm ${error ? "text-danger" : "text-paper-dim"}`}
            >
              {error ??
                (enoughData
                  ? partial
                    ? "A dietitian-style read of the week so far: patterns, averages vs targets, and a focus for the days ahead."
                    : "A dietitian-style review of this week: patterns, averages vs targets, and one focus for the week ahead."
                  : "Log at least 3 days of this week to unlock its report.")}
            </p>
            {enoughData && (
              <button
                type="button"
                onClick={run}
                className="btn-press rounded-xl btn-flame px-5 py-2.5 text-sm font-semibold"
              >
                {error ? "Try again" : "Review my week"}
              </button>
            )}
          </div>
        )}
      </div>
    </Reveal>
  );
}
