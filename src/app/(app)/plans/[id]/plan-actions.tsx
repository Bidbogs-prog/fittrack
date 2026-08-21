"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Trash } from "@phosphor-icons/react";
import { applyPlanToDiary, deletePlan } from "../actions";

/**
 * One-tap "log this plan" (roadmap 1.4) + delete for the user's own
 * AI-generated plans. Apply copies every plan item into the given date's
 * diary and redirects to the dashboard.
 */
export function PlanActions({
  planId,
  date,
  canDelete,
}: {
  planId: string;
  date: string;
  canDelete: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  function apply() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("plan_id", planId);
      fd.set("date", date);
      const res = await applyPlanToDiary(fd);
      if (res?.error) setError(res.error);
    });
  }

  function remove() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("plan_id", planId);
      await deletePlan(fd);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={apply}
        disabled={pending}
        className="btn-press inline-flex items-center gap-2 rounded-xl bg-flame px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-flame-ink hover:bg-flame-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CalendarPlus weight="bold" className="size-4" />
        {pending ? "Logging…" : "Log this day to my diary"}
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={remove}
          onBlur={() => setArmed(false)}
          disabled={pending}
          className={`btn-press inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
            armed
              ? "border-danger/60 bg-danger/10 text-danger"
              : "border-ink-700 text-paper-dim hover:border-danger/50 hover:text-danger"
          }`}
        >
          <Trash weight="bold" className="size-3.5" />
          {armed ? "Tap again to delete" : "Delete plan"}
        </button>
      )}
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
