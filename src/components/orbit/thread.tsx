"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { CaretDown, CheckCircle } from "@phosphor-icons/react";
import { AddFoodDialog } from "@/app/(app)/dashboard/add-food-dialog";
import { EntryRow } from "@/app/(app)/dashboard/entry-row";
import { SaveMealButton } from "@/app/(app)/dashboard/save-meal-button";
import { FoodImage } from "@/components/food-image";
import { entryMacros, entryName } from "@/lib/diary";
import { MEAL_DEFAULT_MIN, entryMinutes, formatClock } from "@/lib/day-time";
import { useNowMinutes } from "@/lib/use-client-clock";
import { sumMacros } from "@/lib/nutrition";
import { MEAL_TYPES, type DiaryEntry, type MealType } from "@/lib/types";
import { useLog } from "./log-provider";

export interface ThreadNudge {
  key: string;
  /** Minute-of-day, or null to pin it at "now". */
  minutes: number | null;
  body: React.ReactNode;
  cta?: { label: string; href: string };
}

/**
 * The day's thread: one card per meal at the time it was eaten, with coach
 * nudges slotted in between. It is the meal log — tap a card to edit its
 * entries — and the place new logs land (rise-in + a glowing dot).
 */
export function Thread({
  entries,
  nudges,
  proteinReached,
  kcalLeft,
  weekday,
}: {
  entries: DiaryEntry[];
  nudges: ThreadNudge[];
  proteinReached: boolean;
  kcalLeft: number;
  /** For saved-meal default names, e.g. "Tuesday". */
  weekday: string;
}) {
  const t = useTranslations("thread");
  const format = useFormatter();
  const tm = useTranslations("meals");
  const { freshIds, entryDate } = useLog();
  const now = useNowMinutes();
  const [openMeal, setOpenMeal] = useState<MealType | null>(null);

  type Row =
    | { kind: "meal"; key: string; minutes: number; meal: MealType; items: DiaryEntry[] }
    | { kind: "nudge"; key: string; minutes: number; nudge: ThreadNudge };

  const rows: Row[] = [];
  for (const meal of MEAL_TYPES) {
    const items = entries.filter((e) => e.meal === meal);
    if (items.length === 0) continue;
    const minutes =
      now == null ? MEAL_DEFAULT_MIN[meal] : Math.min(...items.map((e) => entryMinutes(e)));
    rows.push({ kind: "meal", key: meal, minutes, meal, items });
  }
  for (const nudge of nudges) {
    rows.push({ kind: "nudge", key: nudge.key, minutes: nudge.minutes ?? now ?? 1439, nudge });
  }
  rows.sort((a, b) => a.minutes - b.minutes);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-700 px-5 py-8 text-center">
        <p className="font-display text-base font-semibold text-paper">{t("emptyTitle")}</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-paper-mute">{t("emptyBody")}</p>
      </div>
    );
  }

  return (
    <ol className="relative flex flex-col gap-2.5" aria-label={t("label")}>
      {/* connector (mobile) */}
      <span
        aria-hidden
        className="absolute start-[21px] top-2 bottom-2 w-px bg-[linear-gradient(var(--ink-700),var(--ink-700)_70%,transparent)] lg:hidden"
      />
      {rows.map((row) => {
        if (row.kind === "nudge") {
          const clock = row.nudge.minutes != null || now != null ? formatClock(row.minutes) : "";
          return (
            <li key={row.key} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2.5 lg:grid-cols-[64px_minmax(0,1fr)] lg:gap-3">
              <span className="pt-2.5 lg:pt-3">
                <span className="relative ms-[17px] block size-[9px] rounded-full border-2 border-flame-glow bg-ink-950 lg:hidden" />
                <span className="font-mono text-xs font-medium text-flame max-lg:hidden">{clock}</span>
              </span>
              <div className="nudge rounded-2xl px-3 py-2.5 lg:px-3.5 lg:py-3">
                <p className="font-mono text-[11px] font-medium text-flame lg:hidden">
                  {clock && `${clock} · `}
                  {t("coach")}
                </p>
                <div className="mt-0.5 text-sm leading-snug text-paper lg:mt-0 [&_b]:font-semibold [&_b]:text-flame-glow">
                  {row.nudge.body}
                </div>
                {row.nudge.cta && (
                  <Link
                    href={row.nudge.cta.href}
                    className="mt-1.5 inline-flex min-h-8 items-center text-[13px] font-medium text-flame hover:text-flame-glow"
                  >
                    {row.nudge.cta.label} <span aria-hidden className="ms-1 rtl:-scale-x-100">→</span>
                  </Link>
                )}
              </div>
            </li>
          );
        }

        const totals = sumMacros(row.items.map(entryMacros));
        const fresh = row.items.some((e) => freshIds.has(e.id));
        const open = openMeal === row.meal;
        const photo = row.items.find((e) => e.food?.image_url)?.food?.image_url ?? null;
        const names = row.items.map(entryName).join(", ");
        const clock = formatClock(row.minutes);
        const panelId = `meal-${row.meal}`;

        return (
          <li
            key={row.key}
            className={`grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2.5 lg:grid-cols-[64px_minmax(0,1fr)] lg:gap-3 ${fresh ? "rise-in" : ""}`}
          >
            <span className="pt-2.5 lg:pt-3">
              <span
                className={`relative ms-[17px] block size-[9px] rounded-full lg:hidden ${
                  fresh
                    ? "bg-flame shadow-[0_0_0_3px_var(--ink-950),0_0_12px_var(--flame)]"
                    : "bg-paper shadow-[0_0_0_3px_var(--ink-950)]"
                }`}
              />
              <span className="font-mono text-xs font-medium text-paper-mute tabular max-lg:hidden">{clock}</span>
            </span>
            <div
              className={`overflow-hidden rounded-2xl border bg-ink-900 transition-colors ${
                fresh ? "border-ink-600" : "border-ink-800"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenMeal(open ? null : row.meal)}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start lg:px-3.5 lg:py-3"
              >
                {photo && <FoodImage src={photo} alt="" className="size-10 rounded-[10px] lg:hidden" />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-[11px] text-paper-mute lg:hidden">
                    <span className="font-mono">
                      {clock} · {tm(row.meal)}
                    </span>
                    <span className="font-mono text-paper-dim tabular">{Math.round(totals.kcal)}</span>
                  </span>
                  <span className="mt-0.5 flex items-baseline justify-between gap-3 lg:mt-0">
                    <span className="min-w-0 truncate text-sm text-paper" dir="auto">
                      <b className="font-semibold max-lg:hidden">{tm(row.meal)}</b>
                      <span className="text-paper-dim max-lg:hidden"> · </span>
                      <span className="lg:text-paper-dim">{names}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[13px] text-paper-dim tabular max-lg:hidden">
                      {Math.round(totals.kcal)}
                    </span>
                  </span>
                </span>
                <CaretDown
                  weight="bold"
                  aria-hidden
                  className={`size-3.5 shrink-0 text-paper-mute transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                />
              </button>
              {fresh && (
                <p className="flex items-center gap-1.5 px-3 pb-2.5 text-xs text-fibre lg:px-3.5">
                  <CheckCircle weight="fill" className="size-3.5 shrink-0" />
                  {proteinReached ? `${t("proteinReached")} ` : ""}
                  {kcalLeft >= 0
                    ? t("headroom", { kcal: format.number(kcalLeft) })
                    : t("overBy", { kcal: format.number(Math.abs(kcalLeft)) })}
                </p>
              )}
              <div id={panelId} className="collapse-rows" data-open={open}>
                <div>
                  <div className="border-t border-ink-800">
                    <p className="px-5 pt-2.5 font-mono text-[11px] text-paper-mute tabular">
                      P {Math.round(totals.protein)} · C {Math.round(totals.carbs)} · F {Math.round(totals.fat)} · Fb{" "}
                      {Math.round(totals.fibre)}
                    </p>
                    <ul className="divide-y divide-ink-800/70">
                      {row.items.map((entry) => (
                        <li key={entry.id}>
                          <EntryRow entry={entry} />
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center gap-2 border-t border-ink-800 px-5 py-3">
                      <AddFoodDialog meal={row.meal} entryDate={entryDate} triggerLabel={t("addToMeal")} />
                      <SaveMealButton meal={row.meal} date={entryDate} defaultName={`${weekday} ${tm(row.meal)}`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
