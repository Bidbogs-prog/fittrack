"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarBlank, CaretLeft, CaretRight, X } from "@phosphor-icons/react";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function monthOf(date: string): string {
  return date.slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Calendar day picker for the dashboard header: pick any diary date at a
 * glance. Days with diary entries carry a lime dot (fetched per month via
 * /api/diary/days), the viewed day is filled, today is outlined.
 */
export function CalendarPicker({ selected, today }: { selected: string; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(selected));
  // Logged-day cache per month; null while a month is still loading.
  const [loggedByMonth, setLoggedByMonth] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || loggedByMonth[month]) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/diary/days?month=${month}`, { signal: controller.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { days: string[] };
        setLoggedByMonth((prev) => ({ ...prev, [month]: json.days }));
      } catch {
        // Dots are an enhancement — picking a day still works without them.
      }
    })();
    return () => controller.abort();
  }, [open, month, loggedByMonth]);

  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const startOffset = (new Date(year, monthNum - 1, 1).getDay() + 6) % 7; // Mon=0 … Sun=6
  const logged = new Set(loggedByMonth[month] ?? []);
  const monthLabel = new Date(year, monthNum - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  function pick(date: string) {
    setOpen(false);
    router.push(date === today ? "/dashboard" : `/dashboard?d=${date}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMonth(monthOf(selected));
          setOpen(true);
        }}
        title="Pick a day"
        aria-label="Pick a day"
        className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-ink-800 hover:text-paper pointer-coarse:p-3"
      >
        <CalendarBlank weight="bold" className="size-4" />
      </button>

      {open && (
        <div
          className="overlay-fade fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pick a day"
            className="dialog-pop w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-paper">{monthLabel}</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMonth(shiftMonth(month, -1))}
                  aria-label="Previous month"
                  className="btn-press rounded-md p-2 text-paper-mute hover:bg-ink-800 hover:text-paper"
                >
                  <CaretLeft weight="bold" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMonth(shiftMonth(month, 1))}
                  aria-label="Next month"
                  className="btn-press rounded-md p-2 text-paper-mute hover:bg-ink-800 hover:text-paper"
                >
                  <CaretRight weight="bold" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="btn-press ml-1 rounded-md p-2 text-paper-mute hover:bg-ink-800 hover:text-paper"
                >
                  <X weight="bold" className="size-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((day) => (
                <span
                  key={day}
                  className="py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-paper-mute"
                >
                  {day}
                </span>
              ))}
              {Array.from({ length: startOffset }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const date = `${month}-${String(i + 1).padStart(2, "0")}`;
                const isSelected = date === selected;
                const isToday = date === today;
                const isLogged = logged.has(date);
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => pick(date)}
                    aria-label={`Go to ${date}${isLogged ? " (has entries)" : ""}`}
                    aria-current={isSelected ? "date" : undefined}
                    className={`btn-press flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm tabular transition-colors ${
                      isSelected
                        ? "bg-lime font-semibold text-lime-ink"
                        : `font-mono hover:bg-ink-800 ${
                            isLogged ? "text-paper" : "text-paper-mute hover:text-paper"
                          } ${isToday ? "ring-1 ring-inset ring-lime/60" : ""}`
                    }`}
                  >
                    {i + 1}
                    <span
                      className={`size-1 rounded-full ${
                        isLogged ? (isSelected ? "bg-lime-ink" : "bg-lime") : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-paper-mute">
              <span className="size-1.5 rounded-full bg-lime" />
              Days with logged entries
            </p>
          </div>
        </div>
      )}
    </>
  );
}
