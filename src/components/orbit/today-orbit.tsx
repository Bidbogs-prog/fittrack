"use client";

import { useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { entryMinutes, parseClock } from "@/lib/day-time";
import { useNowMinutes } from "@/lib/use-client-clock";
import type { MealType } from "@/lib/types";
import { useLog } from "./log-provider";
import { Orbit, type OrbitDot } from "./orbit";

export interface OrbitEntry {
  id: string;
  meal: MealType;
  entry_date: string;
  created_at?: string | null;
}

/** Hold longer than this = push-to-talk; shorter = tap to toggle. */
const HOLD_MS = 350;

/**
 * Today's orbit: the dial plus the centre button. Pressing and holding the
 * centre talks to the coach (release to finish); a quick tap toggles
 * listening instead, for one-handed use.
 */
export function TodayOrbit({
  entries,
  rings,
  kcalLeft,
  windowStart,
  windowEnd,
  size = "size-[280px] lg:size-[300px]",
  showHint = true,
}: {
  entries: OrbitEntry[];
  rings: [number, number, number];
  kcalLeft: number;
  windowStart: string | null;
  windowEnd: string | null;
  size?: string;
  showHint?: boolean;
}) {
  const t = useTranslations("orbit");
  const format = useFormatter();
  const log = useLog();

  // Local time is browser-only: dots and "now" appear after mount.
  const now = useNowMinutes();

  const dots: OrbitDot[] =
    now == null
      ? []
      : entries.map((e) => ({ key: e.id, minutes: entryMinutes(e), fresh: log.freshIds.has(e.id) }));

  const startMin = parseClock(windowStart);
  const endMin = parseClock(windowEnd);
  const win = startMin != null && endMin != null ? { startMin, endMin } : null;

  const pressAt = useRef(0);
  const wasListening = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    pressAt.current = Date.now();
    wasListening.current = log.listening;
    if (!log.listening) log.startListening();
  }

  function onPointerUp() {
    if (!pressAt.current) return;
    const held = Date.now() - pressAt.current;
    pressAt.current = 0;
    // A long press releases to finish; a tap on an active mic stops it.
    if (held >= HOLD_MS || wasListening.current) log.stopListening();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.repeat) return;
      if (log.listening) log.stopListening();
      else log.startListening();
    }
  }

  const over = kcalLeft < 0;
  const summary = t("summary", {
    left: Math.abs(kcalLeft),
    over: over ? "over" : "left",
    protein: Math.round(rings[0] * 100),
    carbs: Math.round(rings[1] * 100),
    fat: Math.round(rings[2] * 100),
    meals: entries.length,
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <Orbit
        rings={rings}
        window={win}
        dots={dots}
        now={log.isToday ? now : null}
        summary={summary}
        className={size}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-[28%] rounded-full border border-flame ${
            log.listening ? "halo" : "opacity-0"
          }`}
        />
        <button
          type="button"
          aria-pressed={log.listening}
          aria-label={log.listening ? t("stopTalking") : t("holdToTalk")}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          onContextMenu={(e) => e.preventDefault()}
          className={`absolute inset-[28%] flex touch-none select-none flex-col items-center justify-center rounded-full shadow-[inset_0_0_0_1px_var(--ink-700),0_10px_30px_-10px_rgba(0,0,0,0.8)] transition-[transform,background-color] duration-[400ms] ease-[cubic-bezier(0.34,1.5,0.5,1)] [-webkit-touch-callout:none] ${
            log.listening ? "scale-110 bg-flame-ink" : "bg-ink-900 hover:bg-ink-850"
          }`}
        >
          <span
            className={`font-mono text-[32px] leading-none font-semibold tracking-[-0.04em] tabular lg:text-[36px] ${
              log.listening ? "text-flame" : over ? "text-danger" : "text-paper"
            }`}
          >
            {log.listening ? "···" : format.number(Math.abs(kcalLeft))}
          </span>
          <span className="mt-1 text-[11px] tracking-[0.08em] text-paper-mute uppercase">
            {log.listening ? t("listening") : over ? t("kcalOver") : t("kcalLeft")}
          </span>
        </button>
      </Orbit>
      {showHint && (
        <p className="mt-1 text-center text-xs text-paper-mute" aria-live="polite">
          {log.listening ? (log.interim ? `“${log.interim}”` : t("listeningHint")) : t("hint")}
        </p>
      )}
    </div>
  );
}
