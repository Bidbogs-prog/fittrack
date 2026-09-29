"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CaretDown, X } from "@phosphor-icons/react";
import { formatClock } from "@/lib/day-time";
import { sumMacros } from "@/lib/nutrition";
import { MEAL_TYPES } from "@/lib/types";
import { reviewMacros, useLog, type PendingLog } from "./log-provider";

/**
 * Log confirmation for every source. Mobile: a bottom sheet over a blurred
 * backdrop. Desktop (lg): a 460px popover anchored above the composer —
 * the composer wrapper is the positioning context. ↵ confirms, Esc cancels.
 */
export function ConfirmSheet() {
  const t = useTranslations("log");
  const tm = useTranslations("meals");
  const { sheet, cancel, confirm, confirming, updateItem, removeItem, setMeal, error } = useLog();
  const open = sheet != null;

  // Keep rendering the last content while the sheet animates out.
  const [last, setLast] = useState<PendingLog | null>(sheet);
  if (sheet && sheet !== last) setLast(sheet);
  const view = sheet ?? last;

  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    confirmRef.current?.focus({ preventScroll: true });
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    const previous = document.body.style.overflow;
    if (mobile) document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        return;
      }
      if (
        e.key === "Enter" &&
        !(e.target instanceof HTMLSelectElement) &&
        !(e.target instanceof HTMLButtonElement)
      ) {
        e.preventDefault();
        confirm();
        return;
      }
      if (e.key === "Tab" && panel) {
        // Focus trap: cycle within the dialog.
        const nodes = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled])'
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, cancel, confirm]);

  const items = view?.items ?? [];
  const totals = sumMacros(items.map(reviewMacros));
  const pKcal = totals.protein * 4;
  const cKcal = totals.carbs * 4;
  const fKcal = totals.fat * 9;
  const valid = items.length > 0 && items.every((i) => Number(i.grams) > 0);

  return (
    <>
      {/* Backdrop: mobile only; the desktop popover leaves the page usable. */}
      <div
        aria-hidden
        onClick={cancel}
        className={`fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-[3px] transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("confirmTitle")}
        inert={!open}
        className={`z-50 flex flex-col gap-3 border-ink-600 bg-ink-850 ease-[var(--ease-ui)] max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[85dvh] max-lg:overflow-y-auto max-lg:rounded-t-[28px] max-lg:border-t max-lg:px-5 max-lg:pt-2.5 max-lg:pb-[max(1.75rem,env(safe-area-inset-bottom))] max-lg:shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.7)] max-lg:transition-transform max-lg:duration-500 lg:absolute lg:bottom-full lg:mb-3 lg:w-[460px] lg:max-w-full lg:rounded-[20px] lg:border lg:p-4 lg:shadow-float lg:transition-[opacity,transform] lg:duration-[450ms] lg:start-0 ${
          open
            ? "max-lg:translate-y-0 lg:translate-y-0 lg:opacity-100"
            : "max-lg:translate-y-[105%] lg:pointer-events-none lg:translate-y-3.5 lg:opacity-0"
        }`}
      >
        <span aria-hidden className="mx-auto h-1 w-[38px] shrink-0 rounded-full bg-ink-600 lg:hidden" />

        {view?.transcript && (
          <p className="text-[13px] italic text-paper-mute" dir="auto">
            &ldquo;{view.transcript}&rdquo;
          </p>
        )}
        {view?.source === "photo" && (
          <p className="text-[13px] italic text-paper-mute">{t("fromPhoto")}</p>
        )}

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <label className="relative inline-flex items-baseline gap-2">
            <span className="sr-only">{t("meal")}</span>
            <select
              value={view?.meal ?? "dinner"}
              onChange={(e) => setMeal(e.target.value as PendingLog["meal"])}
              className="cursor-pointer appearance-none bg-transparent pe-5 font-display text-xl font-semibold text-paper outline-none focus-visible:underline lg:text-lg"
            >
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m} className="bg-ink-900 text-base">
                  {tm(m)}
                </option>
              ))}
            </select>
            <CaretDown
              weight="bold"
              aria-hidden
              className="pointer-events-none absolute end-0 top-1/2 size-3.5 -translate-y-1/2 text-paper-mute"
            />
          </label>
          <span className="me-auto font-mono text-sm font-medium text-paper-mute tabular">
            {view ? formatClock(view.minutes) : ""}
          </span>
          <span className="text-xs text-paper-mute max-lg:inline lg:hidden">{t("tapGrams")}</span>
          <span className="font-mono text-xs font-medium text-paper-dim tabular max-lg:hidden">
            {Math.round(totals.kcal)} kcal · <span className="text-protein">P {Math.round(totals.protein)}</span> ·{" "}
            <span className="text-carbs">C {Math.round(totals.carbs)}</span> ·{" "}
            <span className="text-fat">F {Math.round(totals.fat)}</span>
          </span>
        </div>

        <ul className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 lg:rounded-[14px]">
          {items.map((item) => {
            const m = reviewMacros(item);
            const hasChoice = item.base.matches.length > 0;
            return (
              <li
                key={item.key}
                className="flex items-center gap-3 border-b border-ink-800 px-3.5 py-2.5 last:border-b-0 lg:px-3 lg:py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-paper" dir="auto">
                    {item.base.matches.find((f) => f.id === item.source)?.name ?? item.base.name}
                  </p>
                  {hasChoice ? (
                    <label className="relative block max-w-full">
                      <span className="sr-only">{t("dataSource", { name: item.base.name })}</span>
                      <select
                        value={item.source}
                        onChange={(e) => updateItem(item.key, { source: e.target.value })}
                        className="w-full cursor-pointer appearance-none truncate bg-transparent pe-4 font-mono text-[11px] text-paper-mute outline-none hover:text-paper-dim focus-visible:text-paper"
                      >
                        {item.base.matches.map((food) => (
                          <option key={food.id} value={food.id} className="bg-ink-900">
                            {sourceLabel(food.source)} · {Math.round(food.kcal)} kcal/100 g
                            {food.brand ? ` · ${food.brand}` : ""}
                          </option>
                        ))}
                        <option value="est" className="bg-ink-900">
                          {t("aiEstimate")}
                        </option>
                      </select>
                    </label>
                  ) : (
                    <p className="font-mono text-[11px] text-paper-mute">{t("aiEstimate")}</p>
                  )}
                  <p className="font-mono text-[11px] text-paper-mute tabular">
                    {Math.round(m.kcal)} kcal · P {Math.round(m.protein)} · C {Math.round(m.carbs)} · F{" "}
                    {Math.round(m.fat)}
                  </p>
                </div>
                <label className="flex shrink-0 items-center rounded-lg border border-ink-600 font-mono text-[13px] font-medium text-paper focus-within:border-flame/70">
                  <span className="sr-only">{t("gramsOf", { name: item.base.name })}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={5000}
                    value={item.grams}
                    onChange={(e) => updateItem(item.key, { grams: e.target.value })}
                    className="w-14 bg-transparent py-1.5 ps-2 text-end tabular outline-none [appearance:textfield] max-lg:text-base [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="pe-2 ps-1 text-paper-mute">g</span>
                </label>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  aria-label={t("remove", { name: item.base.name })}
                  className="btn-press -me-1.5 grid size-9 shrink-0 place-items-center rounded-lg text-paper-mute hover:bg-ink-800 hover:text-paper"
                >
                  <X weight="bold" className="size-3.5" />
                </button>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-paper-mute">{t("allRemoved")}</li>
          )}
        </ul>

        {/* Calorie share by macro */}
        <div aria-hidden className="flex h-1.5 gap-0.5 overflow-hidden rounded-full lg:hidden">
          <div className="bg-protein" style={{ flex: pKcal || 0.0001 }} />
          <div className="bg-carbs" style={{ flex: cKcal || 0.0001 }} />
          <div className="bg-fat" style={{ flex: fKcal || 0.0001 }} />
        </div>
        <p className="flex justify-between font-mono text-xs font-medium text-paper-dim tabular lg:hidden">
          <span>{Math.round(totals.kcal)} kcal</span>
          <span>
            <span className="text-protein">P {Math.round(totals.protein)}</span> ·{" "}
            <span className="text-carbs">C {Math.round(totals.carbs)}</span> ·{" "}
            <span className="text-fat">F {Math.round(totals.fat)}</span>
          </span>
        </p>

        {error && open && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-0.5 grid grid-cols-[1fr_2fr] gap-2.5 lg:flex lg:justify-end lg:gap-2">
          <button
            type="button"
            onClick={cancel}
            className="btn-press min-h-11 rounded-[14px] border border-ink-700 px-4 text-sm font-medium text-paper-dim hover:text-paper lg:min-h-10 lg:rounded-xl"
          >
            {t("cancel")} <span className="ms-1 font-mono text-[10px] text-paper-mute max-lg:hidden">ESC</span>
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={confirm}
            disabled={confirming || !valid}
            className="btn-flame btn-press min-h-11 rounded-[14px] px-5 text-sm disabled:opacity-40 lg:min-h-10 lg:rounded-xl"
          >
            {confirming ? t("logging") : t("logToOrbit")}{" "}
            <span className="ms-1 font-mono text-[10px] max-lg:hidden">↵</span>
          </button>
        </div>
      </div>
    </>
  );
}

function sourceLabel(source: string): string {
  if (source === "usda") return "USDA";
  if (source === "off") return "OFF";
  return "So3ra";
}
