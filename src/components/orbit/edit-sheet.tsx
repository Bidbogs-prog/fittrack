"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, PencilSimple, Trash } from "@phosphor-icons/react";
import { useLog } from "./log-provider";

/**
 * Confirmation for AI-proposed diary changes ("remove the rice", "make the
 * chicken 200 g"). Nothing is changed until Apply. Sits above the composer
 * like the log sheet; Esc cancels, Enter applies.
 */
export function EditSheet() {
  const t = useTranslations("log");
  const tm = useTranslations("meals");
  const { editSheet, confirmEdits, cancelEdits, confirming } = useLog();
  const applyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!editSheet) return;
    applyRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelEdits();
      else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) confirmEdits();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editSheet, cancelEdits, confirmEdits]);

  if (!editSheet) return null;
  const delta = editSheet.edits.reduce((s, x) => s + (x.kcalAfter - x.kcalBefore), 0);

  return (
    <div
      role="dialog"
      aria-label={t("editTitle")}
      className="dialog-pop flex flex-col gap-3 rounded-[20px] border border-ink-600 bg-ink-850 p-4 shadow-float"
    >
      <p className="text-[13px] italic text-paper-mute" dir="auto">
        &ldquo;{editSheet.transcript}&rdquo;
      </p>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-paper">{t("editTitle")}</h2>
        {delta !== 0 && (
          <span className={`font-mono text-xs font-medium tabular ${delta < 0 ? "text-fibre" : "text-flame"}`}>
            {delta > 0 ? "+" : "−"}
            {Math.abs(delta)} kcal
          </span>
        )}
      </div>
      <ul className="overflow-hidden rounded-[14px] border border-ink-800 bg-ink-900">
        {editSheet.edits.map((x) => {
          const del = x.action === "delete";
          const Icon = del ? Trash : PencilSimple;
          return (
            <li key={x.entryId} className="flex items-center gap-3 border-b border-ink-800 px-3 py-2.5 last:border-b-0">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full ${del ? "bg-danger/10 text-danger" : "bg-flame/10 text-flame"}`}
              >
                <Icon weight="bold" className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${del ? "text-paper-dim line-through" : "text-paper"}`} dir="auto">
                  {x.name}
                </p>
                <p className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-paper-mute tabular">
                  <span>{tm(x.meal)}</span>
                  <span aria-hidden>·</span>
                  <span>{x.before}</span>
                  {x.after && (
                    <>
                      <ArrowRight aria-hidden className="size-3 rtl:-scale-x-100" />
                      <span className="text-paper">{x.after}</span>
                    </>
                  )}
                  {x.toMeal && (
                    <>
                      <ArrowRight aria-hidden className="size-3 rtl:-scale-x-100" />
                      <span className="text-paper">{tm(x.toMeal)}</span>
                    </>
                  )}
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs text-paper-mute tabular">
                {del ? `−${x.kcalBefore}` : x.kcalAfter !== x.kcalBefore ? `${x.kcalAfter - x.kcalBefore > 0 ? "+" : "−"}${Math.abs(x.kcalAfter - x.kcalBefore)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
      {editSheet.then.length > 0 && <p className="text-xs text-paper-mute">{t("editThenAdd", { count: editSheet.then.length })}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={cancelEdits}
          className="btn-press min-h-10 rounded-xl px-4 text-sm font-medium text-paper-dim hover:text-paper"
        >
          {t("editCancel")}
        </button>
        <button
          ref={applyRef}
          type="button"
          onClick={confirmEdits}
          disabled={confirming}
          className="btn-press btn-flame min-h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
        >
          {t("editApply")}
        </button>
      </div>
    </div>
  );
}
