"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, X } from "@phosphor-icons/react";
import { track } from "@/lib/analytics";
import { completeTour } from "./app-tour-actions";

/**
 * First-run guided tour on Today. Each step spotlights a real part of the
 * page (elements tagged data-tour="…") with a short card; steps whose target
 * isn't on screen (e.g. the rail on mobile) show as a centred card instead.
 * Shown once per account (profiles.tour_completed_at); replayable from Me
 * via /dashboard?tour=1. Esc or "Skip" ends it; ← → move between steps.
 */
const STEPS = [
  { key: "welcome", target: null },
  { key: "orbit", target: "orbit" },
  { key: "log", target: "composer" },
  { key: "edit", target: "composer" },
  { key: "coach", target: "composer" },
  { key: "weight", target: "weight" },
  { key: "tabs", target: "nav" },
  { key: "done", target: null },
] as const;

const PAD = 8;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The first visible element for a tour target (both desktop and mobile navs carry "nav"). */
function findTarget(name: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function AppTour({ firstName }: { firstName: string }) {
  const t = useTranslations("tour");
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = useCallback(
    (how: "done" | "skipped") => {
      setOpen(false);
      track(how === "done" ? "tour_completed" : "tour_skipped", { step: STEPS[step].key });
      void completeTour().catch(() => {});
      // Drop ?tour=1 so a refresh doesn't replay it.
      const url = new URL(window.location.href);
      if (url.searchParams.has("tour")) {
        url.searchParams.delete("tour");
        window.history.replaceState(null, "", url.toString());
      }
    },
    [step]
  );

  useEffect(() => {
    track("tour_started", {});
  }, []);

  // Measure the target: scroll it into view, then keep the spotlight on it.
  useLayoutEffect(() => {
    if (!open) return;
    const el = current.target ? findTarget(current.target) : null;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    let frame = 0;
    // Measured in a frame callback (no target = centred card, box null).
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!el) return setBox(null);
        const r = el.getBoundingClientRect();
        setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
      });
    };
    measure();
    const settle = window.setTimeout(measure, 450);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, current.target]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish("skipped");
      const rtl = document.documentElement.dir === "rtl";
      const fwd = rtl ? "ArrowLeft" : "ArrowRight";
      const back = rtl ? "ArrowRight" : "ArrowLeft";
      if (e.key === fwd) {
        if (last) finish("done");
        else setStep((s) => s + 1);
      }
      if (e.key === back && step > 0) setStep((s) => s - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, step, last, finish]);

  if (!open) return null;

  // Card goes on the opposite half of the screen from the spotlight.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardAtTop = box != null && box.top + box.height / 2 > vh / 2;
  const startLogging = () => {
    finish("done");
    document.querySelector<HTMLTextAreaElement>('[data-tour="composer"] textarea')?.focus();
  };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Dim layer; the spotlight is a transparent box with a huge shadow. */}
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-2xl ring-2 ring-flame/70 transition-all duration-300 ease-[var(--ease-ui)]"
          style={{ ...box, boxShadow: "0 0 0 9999px rgba(11,9,7,0.72)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-ink-950/75 backdrop-blur-[2px]" />
      )}
      {/* Clicks outside the card don't fall through to the page. */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        className={`dialog-pop fixed inset-x-3 mx-auto max-w-md rounded-[22px] border border-ink-700 bg-ink-850 p-5 shadow-float ${
          box == null
            ? "top-1/2 -translate-y-1/2"
            : cardAtTop
              ? "top-[max(1rem,env(safe-area-inset-top))]"
              : "bottom-[max(1rem,env(safe-area-inset-bottom))]"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-paper-mute tabular">
            {step + 1} / {STEPS.length}
          </p>
          {!last && (
            <button
              type="button"
              onClick={() => finish("skipped")}
              className="-me-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-paper-mute hover:text-paper"
            >
              {t("skip")} <X weight="bold" className="size-3" />
            </button>
          )}
        </div>
        <h2 id="tour-title" className="mt-2 font-display text-xl font-semibold tracking-tight text-paper">
          {t(`${current.key}.title`, { name: firstName })}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">{t(`${current.key}.body`)}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s.key} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-flame" : "w-1.5 bg-ink-700"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                aria-label={t("back")}
                className="grid size-10 place-items-center rounded-xl border border-ink-700 text-paper-dim hover:text-paper"
              >
                <ArrowLeft weight="bold" className="size-4 rtl:-scale-x-100" />
              </button>
            )}
            {last ? (
              <button type="button" onClick={startLogging} className="btn-press btn-flame min-h-10 rounded-xl px-4 text-sm font-semibold">
                {t("start")}
              </button>
            ) : (
              <button
                type="button"
                autoFocus
                onClick={() => setStep((s) => s + 1)}
                className="btn-press btn-flame inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold"
              >
                {step === 0 ? t("begin") : t("next")}
                <ArrowRight weight="bold" className="size-4 rtl:-scale-x-100" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
