"use client";

import { useState, useTransition } from "react";
import { ArrowClockwise, CaretLeft, CaretRight, Notebook } from "@phosphor-icons/react";
import { Reveal } from "@/components/motion/reveal";
import { generateWeekReport, type WeekReport } from "./report";

const KIND_CHIP: Record<WeekReport["highlights"][number]["kind"], string> = {
  win: "bg-lime/10 text-lime ring-lime/25",
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
    <Reveal as="section" className="rounded-2xl border border-ink-800 bg-ink-900/60">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-lime/10 ring-1 ring-inset ring-lime/25">
            <Notebook weight="fill" className="size-4.5 text-lime" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-paper">Weekly report</h2>
            <p className="text-[11px] text-paper-mute">
              {week.label} · {week.loggedDays}/{week.daysTotal} days logged
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
              className="btn-press ml-1 rounded-md p-2.5 text-paper-mute hover:bg-ink-800 hover:text-paper disabled:opacity-40"
            >
              <ArrowClockwise className={`size-4 ${isPending ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </header>

      <div className="px-5 py-4">
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
            <p className="font-display text-lg font-semibold tracking-tight text-paper">
              {report.summary}
            </p>
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
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-lime">
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
                className="btn-press rounded-xl bg-lime px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
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
