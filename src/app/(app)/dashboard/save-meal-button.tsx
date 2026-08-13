"use client";

import { useEffect, useState, useTransition } from "react";
import { BookmarkSimple, X } from "@phosphor-icons/react";
import { track } from "@/lib/analytics";
import type { MealType } from "@/lib/types";
import { saveMealAsGroup } from "./actions";

/**
 * Saves one meal's logged entries as a named group (saved meal) for
 * one-tap re-logging from the add-food dialog on other days.
 */
export function SaveMealButton({
  meal,
  date,
  defaultName,
}: {
  meal: MealType;
  date: string;
  defaultName: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function submit() {
    const fd = new FormData();
    fd.set("from_date", date);
    fd.set("meal", meal);
    fd.set("name", name);
    startTransition(async () => {
      const res = await saveMealAsGroup(fd).catch(() => ({
        error: "Saving failed — check your connection and try again.",
      }));
      if (res?.error) {
        setError(res.error);
        return;
      }
      track("meal_saved", { meal });
      setOpen(false);
      setError(null);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(defaultName);
          setError(null);
          setOpen(true);
        }}
        title={`Save this ${meal} as a meal`}
        aria-label={`Save this ${meal} as a meal`}
        className="btn-press rounded-lg border border-ink-700 p-2 text-paper-mute transition-colors hover:border-lime/50 hover:text-lime"
      >
        <BookmarkSimple weight="bold" className="size-3.5" />
      </button>

      {open && (
        <div
          className="overlay-fade fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label={`Save ${meal} as a meal`}
            className="dialog-pop w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-paper">Save as meal</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-ink-800 hover:text-paper"
              >
                <X className="size-4" weight="bold" />
              </button>
            </div>
            <p className="mt-2 text-sm text-paper-dim">
              Everything logged in this {meal} is saved as a group you can add back from the food
              picker on any day.
            </p>
            <div className="mt-4 space-y-2">
              <label htmlFor={`save-meal-name-${meal}`} className="field-label">
                Name
              </label>
              <input
                id={`save-meal-name-${meal}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
                autoFocus
                className="field"
              />
            </div>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="btn-press mt-4 w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Saving…" : "Save meal"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
