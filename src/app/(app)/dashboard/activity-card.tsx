"use client";

import { useState, useTransition } from "react";
import { Barbell, Footprints, Plus, X } from "@phosphor-icons/react";
import type { ExerciseLog } from "@/lib/types";
import { addExercise, deleteExercise, logSteps } from "./actions";

/**
 * Activity card (roadmap 2.4): manual workouts for the viewed day plus a
 * daily step count. Burned kcal raises the day's calorie target when
 * targets are formula-based; with adaptive TDEE the burn is already in
 * the measured number, so it's shown as information only.
 */
export function ActivityCard({
  date,
  exercises,
  steps: serverSteps,
  adaptive,
}: {
  date: string;
  exercises: ExerciseLog[];
  steps: number | null;
  /** True when adaptive TDEE drives the targets. */
  adaptive: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [steps, setSteps] = useState(serverSteps != null ? String(serverSteps) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const burned = exercises.reduce((sum, e) => sum + e.kcal, 0);

  function submitWorkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("date", date);
    setError(null);
    startTransition(async () => {
      const res = await addExercise(fd);
      if (res?.error) setError(res.error);
      else setShowForm(false);
    });
  }

  function submitSteps(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("date", date);
    fd.set("steps", steps || "0");
    setError(null);
    startTransition(async () => {
      const res = await logSteps(fd);
      if (res?.error) setError(res.error);
    });
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => deleteExercise(fd));
  }

  return (
    <section className="rounded-2xl border border-ink-800 bg-ink-900/60">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-lime/10 ring-1 ring-inset ring-lime/25">
            <Barbell weight="fill" className="size-4.5 text-lime" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-paper">Activity</h2>
            <p className="text-[11px] text-paper-mute">
              {burned > 0
                ? adaptive
                  ? `${burned} kcal burned — already reflected in your adaptive burn`
                  : `${burned} kcal burned, added to today's target`
                : "Log workouts and steps for this day"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setError(null);
          }}
          className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-paper-dim transition-colors hover:border-lime/50 hover:text-lime pointer-coarse:py-2.5"
        >
          <Plus weight="bold" className="size-3.5" />
          Add workout
        </button>
      </header>

      <div className="px-5 py-4">
        {exercises.length > 0 && (
          <ul className="divide-y divide-ink-800/70">
            {exercises.map((ex) => (
              <li key={ex.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-paper">{ex.name}</p>
                  {ex.minutes != null && (
                    <p className="text-[11px] text-paper-mute">{ex.minutes} min</p>
                  )}
                </div>
                <span className="shrink-0 font-mono text-sm text-paper-dim tabular">
                  {ex.kcal} kcal
                </span>
                <button
                  type="button"
                  onClick={() => remove(ex.id)}
                  disabled={pending}
                  aria-label={`Delete ${ex.name}`}
                  className="btn-press -m-1 shrink-0 rounded-md p-1.5 text-paper-mute hover:text-paper disabled:opacity-40 pointer-coarse:p-2.5"
                >
                  <X weight="bold" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {showForm && (
          <form onSubmit={submitWorkout} className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              name="name"
              required
              maxLength={80}
              autoFocus
              placeholder="e.g. Evening run"
              aria-label="Workout name"
              className="field"
            />
            <input
              name="minutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              placeholder="min"
              aria-label="Minutes (optional)"
              className="field w-full tabular sm:w-24"
            />
            <input
              name="kcal"
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              required
              placeholder="kcal"
              aria-label="Calories burned"
              className="field w-full tabular sm:w-28"
            />
            <button
              type="submit"
              disabled={pending}
              className="btn-press rounded-xl bg-lime px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep disabled:opacity-40"
            >
              {pending ? "Saving…" : "Log"}
            </button>
          </form>
        )}

        <form
          onSubmit={submitSteps}
          className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-800 pt-3"
        >
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-paper-mute">
            <Footprints weight="fill" className="size-4" />
            Steps
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={200000}
            step={100}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="e.g. 8000"
            aria-label="Steps for this day"
            className="field w-32 py-2 tabular"
          />
          <button
            type="submit"
            disabled={pending || steps === "" || Number(steps) === (serverSteps ?? NaN)}
            className="btn-press rounded-lg border border-ink-700 px-3 py-2 text-xs font-semibold text-paper-dim transition-colors hover:border-lime/50 hover:text-lime disabled:opacity-40"
          >
            Save
          </button>
          <span className="text-[11px] text-paper-mute">
            Manual for now — HealthKit / Google Fit come with the native app.
          </span>
        </form>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </section>
  );
}
