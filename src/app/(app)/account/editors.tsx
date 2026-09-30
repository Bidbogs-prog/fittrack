"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { C, pointAt, windowArc } from "@/components/orbit/orbit-math";
import { formatClock, parseClock } from "@/lib/day-time";
import { MACRO_PCT_MAX, MACRO_PCT_MIN, MACRO_PRESETS, type MacroSplit } from "@/lib/nutrition";
import { saveFastingWindow, saveMacroSplit } from "./actions";

const SNAP = 15;

function isRtl(el: Element | null): boolean {
  return !!el && getComputedStyle(el).direction === "rtl";
}

/** Minute-of-day under a pointer, measured around the dial's centre. */
function minutesAt(svg: SVGSVGElement, clientX: number, clientY: number): number {
  const r = svg.getBoundingClientRect();
  let dx = clientX - (r.left + r.width / 2);
  const dy = clientY - (r.top + r.height / 2);
  if (isRtl(svg)) dx = -dx; // the SVG is mirrored in RTL
  let a = Math.atan2(dx, -dy);
  if (a < 0) a += 2 * Math.PI;
  const min = (a / (2 * Math.PI)) * 1440;
  return (Math.round(min / SNAP) * SNAP) % 1440;
}

/**
 * Eating window on a mini dial: drag either handle around the clock (15-min
 * steps), or focus one and use the arrow keys. Saves through
 * saveFastingWindow; "Turn off" clears both times.
 */
export function WindowEditor({ start, end }: { start: string | null; end: string | null }) {
  const t = useTranslations("me");
  const initialStart = parseClock(start);
  const initialEnd = parseClock(end);
  const [win, setWin] = useState<{ s: number; e: number } | null>(
    initialStart != null && initialEnd != null ? { s: initialStart, e: initialEnd } : null
  );
  const [drag, setDrag] = useState<"s" | "e" | null>(null);

  const dirty = !win
    ? initialStart != null
    : win.s !== initialStart || win.e !== initialEnd;

  function move(which: "s" | "e", min: number) {
    setWin((w) => {
      if (!w) return w;
      const next = { ...w, [which]: ((min % 1440) + 1440) % 1440 };
      return next.s === next.e ? w : next;
    });
  }

  const arc = win ? windowArc({ startMin: win.s, endMin: win.e }) : null;
  const hours = win ? ((((win.e - win.s) % 1440) + 1440) % 1440) / 60 : 0;

  return (
    <div className="flex items-center gap-4 lg:gap-[18px]">
      <svg
        viewBox="0 0 240 240"
        className="size-[104px] shrink-0 touch-none rtl:-scale-x-100 lg:size-[120px]"
        onPointerMove={(e) => {
          if (drag) move(drag, minutesAt(e.currentTarget, e.clientX, e.clientY));
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        role="group"
        aria-label={t("windowLabel")}
      >
        <circle cx="120" cy="120" r="104" fill="none" stroke="var(--ink-600)" strokeWidth="4" strokeDasharray="1 26.2" />
        <circle cx="120" cy="120" r="84" fill="none" stroke="var(--ink-800)" strokeWidth="16" />
        {arc && (
          <circle
            cx="120"
            cy="120"
            r="84"
            fill="none"
            stroke="var(--flame)"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${(arc.length / C(106)) * C(84)} ${C(84)}`}
            transform={`rotate(${arc.rotate} 120 120)`}
          />
        )}
        {win &&
          (["s", "e"] as const).map((which) => {
            const p = pointAt(win[which], 84);
            return (
              <circle
                key={which}
                cx={p.x}
                cy={p.y}
                r="16"
                fill="var(--ink-950)"
                stroke="var(--flame-glow)"
                strokeWidth="6"
                tabIndex={0}
                role="slider"
                aria-label={which === "s" ? t("firstMeal") : t("lastMeal")}
                aria-valuemin={0}
                aria-valuemax={1439}
                aria-valuenow={win[which]}
                aria-valuetext={formatClock(win[which])}
                className="cursor-grab outline-none focus-visible:stroke-paper active:cursor-grabbing"
                onPointerDown={(e) => {
                  setDrag(which);
                  e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                }}
                onKeyDown={(e) => {
                  const up = e.key === "ArrowUp" || e.key === "ArrowRight";
                  const down = e.key === "ArrowDown" || e.key === "ArrowLeft";
                  if (!up && !down) return;
                  e.preventDefault();
                  move(which, win[which] + (up ? SNAP : -SNAP));
                }}
              />
            );
          })}
      </svg>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-paper-mute uppercase">{t("eatingWindow")}</p>
        <p className="mt-1 font-mono text-lg font-semibold text-paper tabular lg:text-[22px]">
          {win ? `${formatClock(win.s)}–${formatClock(win.e)}` : t("windowOff")}
        </p>
        <p className="mt-0.5 text-xs text-flame lg:text-[13px]">
          {win ? t("windowHint", { hours: Math.round(hours * 10) / 10 }) : t("windowOffHint")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {win ? (
            <>
              {dirty && (
                <form action={saveFastingWindow}>
                  <input type="hidden" name="start" value={formatClock(win.s)} />
                  <input type="hidden" name="end" value={formatClock(win.e)} />
                  <button type="submit" className="btn-flame btn-press min-h-9 rounded-lg px-3 text-xs">
                    {t("save")}
                  </button>
                </form>
              )}
              <form action={saveFastingWindow}>
                <input type="hidden" name="start" value="" />
                <input type="hidden" name="end" value="" />
                <button
                  type="submit"
                  className="btn-press min-h-9 rounded-lg border border-ink-700 px-3 text-xs text-paper-dim hover:text-paper"
                >
                  {t("turnOff")}
                </button>
              </form>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setWin({ s: 12 * 60, e: 20 * 60 })}
              className="btn-tint btn-press min-h-9 rounded-lg px-3 text-xs font-medium"
            >
              {t("setWindow")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Draggable three-segment macro split (percent of calories). Dragging a
 * divider moves calories between its neighbours; bounds and the 100% sum
 * are enforced here and re-checked in saveMacroSplit.
 */
export function SplitEditor({
  saved,
  effective,
}: {
  /** The user's custom split, or null on the coach formula. */
  saved: MacroSplit | null;
  /** What the targets currently resolve to, for display in formula mode. */
  effective: MacroSplit;
}) {
  const t = useTranslations("me");
  const [split, setSplit] = useState<MacroSplit>(saved ?? effective);
  const [custom, setCustom] = useState(saved != null);
  const [drag, setDrag] = useState<0 | 1 | null>(null);

  const a = split.protein;
  const b = split.protein + split.carbs;
  const changed =
    custom && (!saved || saved.protein !== split.protein || saved.carbs !== split.carbs || saved.fat !== split.fat);

  function setDivider(which: 0 | 1, pos: number) {
    const p = Math.round(pos);
    let na = a;
    let nb = b;
    if (which === 0) na = Math.min(Math.max(p, MACRO_PCT_MIN, b - MACRO_PCT_MAX), b - MACRO_PCT_MIN, MACRO_PCT_MAX);
    else nb = Math.min(Math.max(p, a + MACRO_PCT_MIN, 100 - MACRO_PCT_MAX), 100 - MACRO_PCT_MIN, a + MACRO_PCT_MAX);
    setSplit({ protein: na, carbs: nb - na, fat: 100 - nb });
    setCustom(true);
  }

  function pctAt(el: HTMLElement, clientX: number): number {
    const r = el.getBoundingClientRect();
    const x = isRtl(el) ? r.right - clientX : clientX - r.left;
    return (x / r.width) * 100;
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative flex h-3 touch-none gap-[3px]"
        onPointerMove={(e) => {
          if (drag != null) setDivider(drag, pctAt(e.currentTarget, e.clientX));
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <div className="rounded-md bg-protein" style={{ flex: split.protein }} />
        <div className="rounded-md bg-carbs" style={{ flex: split.carbs }} />
        <div className="rounded-md bg-fat" style={{ flex: split.fat }} />
        {([0, 1] as const).map((i) => (
          <button
            key={i}
            type="button"
            role="slider"
            aria-label={i === 0 ? t("dividerPC") : t("dividerCF")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={i === 0 ? a : b}
            aria-valuetext={`P ${split.protein}% · C ${split.carbs}% · F ${split.fat}%`}
            onPointerDown={(e) => {
              setDrag(i);
              e.currentTarget.parentElement?.setPointerCapture(e.pointerId);
            }}
            onKeyDown={(e) => {
              const up = e.key === "ArrowRight" || e.key === "ArrowUp";
              const down = e.key === "ArrowLeft" || e.key === "ArrowDown";
              if (!up && !down) return;
              e.preventDefault();
              const rtlFlip = isRtl(e.currentTarget) && (e.key === "ArrowRight" || e.key === "ArrowLeft") ? -1 : 1;
              setDivider(i, (i === 0 ? a : b) + (up ? 1 : -1) * rtlFlip);
            }}
            className="group absolute top-1/2 grid size-11 -translate-y-1/2 cursor-ew-resize place-items-center outline-none ltr:-translate-x-1/2 rtl:translate-x-1/2"
            style={{ insetInlineStart: `${i === 0 ? a : b}%` }}
          >
            <span className="h-5 w-1.5 rounded-full bg-paper shadow-[0_0_0_3px_var(--ink-900)] group-focus-visible:bg-flame-glow" />
          </button>
        ))}
      </div>
      <p className="flex justify-between font-mono text-xs text-paper-dim tabular">
        <span className="text-protein">P {split.protein}%</span>
        <span className="text-carbs">C {split.carbs}%</span>
        <span className="text-fat">F {split.fat}%</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {MACRO_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => {
              setSplit({ ...preset.split });
              setCustom(true);
            }}
            className="btn-press min-h-8 rounded-full border border-ink-700 px-2.5 text-[11px] text-paper-dim hover:text-paper"
          >
            {t(`preset.${preset.key}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {changed && (
          <form action={saveMacroSplit}>
            <input type="hidden" name="mode" value="custom" />
            <input type="hidden" name="protein_pct" value={split.protein} />
            <input type="hidden" name="carbs_pct" value={split.carbs} />
            <input type="hidden" name="fat_pct" value={split.fat} />
            <button type="submit" className="btn-flame btn-press min-h-9 rounded-lg px-3 text-xs">
              {t("saveSplit")}
            </button>
          </form>
        )}
        {(saved != null || custom) && (
          <form action={saveMacroSplit}>
            <input type="hidden" name="mode" value="auto" />
            <button
              type="submit"
              className="btn-press min-h-9 rounded-lg px-1 text-xs text-paper-mute underline-offset-4 hover:text-paper hover:underline"
            >
              {t("resetSplit")}
            </button>
          </form>
        )}
        {!custom && <span className="text-xs text-paper-mute">{t("splitHint")}</span>}
      </div>
    </div>
  );
}
