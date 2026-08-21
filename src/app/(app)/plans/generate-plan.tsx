"use client";

import { useState, useTransition } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { generateAiPlan } from "./actions";

/**
 * "Plan my day with AI" card (roadmap 1.4). Free-text preferences go to
 * the generateAiPlan action, which composes a day from real library foods
 * and redirects to the new private plan.
 */
export function GeneratePlan() {
  const [preferences, setPreferences] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("preferences", preferences);
      const res = await generateAiPlan(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <section className="rounded-2xl border border-flame/25 bg-flame/[0.04] p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-flame/10 ring-1 ring-inset ring-flame/25">
          <Sparkle weight="fill" className="size-4.5 text-flame" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-paper">Plan my day with AI</h2>
          <p className="text-[11px] text-paper-mute">
            A full day from real library foods, matched to your calorie and macro targets
          </p>
        </div>
      </div>
      <textarea
        value={preferences}
        onChange={(e) => setPreferences(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Anything to respect? e.g. no pork, eggs for breakfast, cheap staples, hate tuna"
        className="field mt-4 h-auto resize-none py-3 leading-relaxed"
      />
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="btn-press mt-3 inline-flex items-center gap-2 rounded-xl bg-flame px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-flame-ink hover:bg-flame-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Composing your day…" : "Generate plan"}
      </button>
    </section>
  );
}
