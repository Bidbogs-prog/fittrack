"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Barbell, Footprints, Plus, X } from "@phosphor-icons/react";
import type { ExerciseLog } from "@/lib/types";
import { IntentButton } from "@/components/intent-button";
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
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const tMacro = useTranslations("macros");
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
    <section className="@container rounded-[18px] border border-ink-800 bg-ink-900">
      <header className="flex flex-wrap items-center justify-between gap-3 px-3.5 pt-3.5">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-paper">
              <Barbell weight="fill" className="size-3.5 text-flame" />
              {t("activity")}
            </h2>
            <p className="text-[11px] text-paper-mute">
              {burned > 0
                ? adaptive
                  ? t("burnedAdaptive", { kcal: burned })
                  : t("burnedAddedToTarget", { kcal: burned })
                : t("activityHint")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setError(null);
          }}
          className="btn-tint btn-press inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium"
        >
          <Plus weight="bold" className="size-3.5" />
          {t("addWorkout")}
        </button>
      </header>

      <div className="px-3.5 pt-2 pb-3.5">
        {exercises.length > 0 && (
          <ul className="divide-y divide-ink-800/70">
            {exercises.map((ex) => (
              <li key={ex.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-paper">{ex.name}</p>
                  {ex.minutes != null && (
                    <p className="text-[11px] text-paper-mute">
                      {t("minutesValue", { minutes: ex.minutes })}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-mono text-sm text-paper-dim tabular">
                  {t("kcalValue", { kcal: ex.kcal })}
                </span>
                <button
                  type="button"
                  onClick={() => remove(ex.id)}
                  disabled={pending}
                  aria-label={t("deleteExercise", { name: ex.name })}
                  className="btn-press -m-1 shrink-0 rounded-md p-1.5 text-paper-mute hover:text-paper disabled:opacity-40 pointer-coarse:p-2.5"
                >
                  <X weight="bold" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {showForm && (
          <form onSubmit={submitWorkout} className="mt-2 grid grid-cols-2 gap-2 @md:grid-cols-[1fr_auto_auto_auto]">
            <input
              name="name"
              required
              maxLength={80}
              autoFocus
              placeholder={t("workoutNamePlaceholder")}
              aria-label={t("workoutName")}
              className="field col-span-2 @md:col-span-1"
            />
            <input
              name="minutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              placeholder={t("minutesShort")}
              aria-label={t("minutesOptional")}
              className="field w-full tabular @md:w-24"
            />
            <input
              name="kcal"
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              required
              placeholder={tMacro("kcal")}
              aria-label={t("caloriesBurned")}
              className="field w-full tabular @md:w-28"
            />
            <button
              type="submit"
              disabled={pending}
              className="btn-flame btn-press col-span-2 rounded-xl px-4 py-2.5 text-sm @md:col-span-1 disabled:opacity-40"
            >
              {pending ? tCommon("saving") : tCommon("log")}
            </button>
          </form>
        )}

        <form
          onSubmit={submitSteps}
          className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-800 pt-3"
        >
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-paper-mute">
            <Footprints weight="fill" className="size-4" />
            {t("steps")}
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={200000}
            step={100}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder={t("stepsPlaceholder")}
            aria-label={t("stepsForDay")}
            className="field w-28 min-w-0 flex-1 py-2 tabular"
          />
          <button
            type="submit"
            disabled={pending || steps === "" || Number(steps) === (serverSteps ?? NaN)}
            className="btn-press rounded-lg border border-ink-700 px-3 py-2 text-xs font-semibold text-paper-dim transition-colors hover:border-flame/50 hover:text-flame disabled:opacity-40"
          >
            {tCommon("save")}
          </button>
          <span className="w-full text-[11px] text-paper-mute">{t("stepsHint")}</span>
        </form>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-3 border-t border-ink-800 pt-3">
          <IntentButton
            kind="native"
            surface="activity"
            label={t("syncCta")}
            doneLabel={t("syncDone")}
            className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-flame hover:text-flame-glow"
          />
        </div>
      </div>
    </section>
  );
}
