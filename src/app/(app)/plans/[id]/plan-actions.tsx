"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkle, Trash } from "@phosphor-icons/react";
import { applyPlanToDiary, deletePlan } from "../actions";

/**
 * One-tap "apply to today's orbit" (roadmap 1.4), "ask the coach to adapt
 * it", and delete for the user's own AI-generated plans. Apply copies every
 * plan item into the given date's diary and redirects to the dashboard.
 */
export function PlanActions({
  planId,
  date,
  canDelete,
  coachHref,
}: {
  planId: string;
  date: string;
  canDelete: boolean;
  coachHref: string;
}) {
  const t = useTranslations("plans");
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
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={apply}
        disabled={pending}
        className="btn-flame btn-press glow-flame min-h-12 rounded-[14px] px-5 text-sm max-lg:w-full disabled:opacity-40"
      >
        {pending ? t("applying") : t("apply")}
      </button>
      <Link
        href={coachHref}
        className="btn-tint btn-press inline-flex min-h-12 items-center gap-2 rounded-[14px] px-5 text-sm font-medium max-lg:flex-1 max-lg:justify-center"
      >
        <Sparkle weight="fill" className="size-4" />
        {t("adapt")}
      </Link>
      {canDelete && (
        <button
          type="button"
          onClick={remove}
          onBlur={() => setArmed(false)}
          disabled={pending}
          className={`btn-press inline-flex min-h-12 items-center gap-1.5 rounded-[14px] border px-4 text-xs font-semibold transition-colors disabled:opacity-40 ${
            armed
              ? "border-danger/60 bg-danger/10 text-danger"
              : "border-ink-700 text-paper-dim hover:border-danger/50 hover:text-danger"
          }`}
        >
          <Trash weight="bold" className="size-3.5" />
          {armed ? t("confirmDelete") : t("delete")}
        </button>
      )}
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
