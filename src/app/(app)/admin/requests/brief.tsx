import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { PlanBrief } from "@/lib/plan-brief";

const FLAG_LABEL: Record<string, string> = {
  underage: "Under 18",
  low_bmi: "BMI under 18.5",
  target_at_floor: "Target at the 1,200 kcal floor",
  very_low_intake: "Very low logged intake",
  rapid_loss: "Rapid weight loss",
};

/**
 * The requester's brief, snapshotted when they asked for a plan. Compact on
 * the requests list; full (with the coach's recent-eating context) in the
 * plan builder. Safety flags come first: a restricted user must not get a
 * deficit-focused plan.
 */
export function PlanBriefCard({
  brief,
  note,
  compact = false,
}: {
  brief: PlanBrief | null;
  note: string | null;
  compact?: boolean;
}) {
  if (!brief) {
    return (
      <p className="rounded-lg bg-ink-800/60 px-3.5 py-2.5 text-xs text-paper-mute">
        No brief for this request (sent before briefs existed). Ask them to cancel and request again to share their
        profile and targets.
      </p>
    );
  }

  const facts: [string, string][] = [
    ["Age", brief.age != null ? String(brief.age) : "—"],
    ["Sex", brief.gender ?? "—"],
    ["Height", brief.heightCm != null ? `${brief.heightCm} cm` : "—"],
    ["Weight", brief.weightKg != null ? `${brief.weightKg} kg` : "—"],
    ["Activity", brief.activity ?? "—"],
    ["Goal", brief.goal ?? "—"],
    ...(brief.eatingWindow ? ([["Eating window", brief.eatingWindow]] as [string, string][]) : []),
  ];
  const t = brief.targets;

  return (
    <div className="flex flex-col gap-3">
      {brief.safety?.restricted && (
        <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-2.5 text-xs leading-relaxed text-danger">
          <WarningCircle weight="bold" className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">Care needed:</strong>{" "}
            {brief.safety.flags.map((f) => FLAG_LABEL[f] ?? f).join(" · ")}. Build at maintenance — no deficit, no
            restriction — and encourage them to involve a doctor or dietitian.
          </span>
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] tracking-wide text-paper-mute uppercase">{k}</dt>
            <dd className="text-paper capitalize">{v}</dd>
          </div>
        ))}
      </dl>

      {t && (
        <p className="font-mono text-xs text-paper-dim tabular">
          Targets: <span className="text-paper">{t.kcal} kcal</span> · P {t.protein} g · C {t.carbs} g · F {t.fat} g ·
          fibre {t.fibre} g <span className="text-paper-mute">({t.adaptive ? "adaptive" : "formula"})</span>
        </p>
      )}

      {note && (
        <p className="rounded-lg bg-ink-800/60 px-3.5 py-2.5 text-xs leading-relaxed text-paper-dim">
          <span className="font-semibold text-paper">Their note:</span> {note}
        </p>
      )}

      {!compact && brief.context && (
        <details className="group rounded-lg border border-ink-800">
          <summary className="cursor-pointer list-none px-3.5 py-2.5 text-xs font-semibold text-paper-dim hover:text-paper [&::-webkit-details-marker]:hidden">
            Recent eating, frequent foods, weight and training
          </summary>
          <pre className="max-h-96 overflow-auto px-3.5 pb-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-paper-dim">
            {brief.context}
          </pre>
        </details>
      )}

      <p className="text-[10px] text-paper-mute">
        Snapshot from{" "}
        {new Date(brief.capturedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </p>
    </div>
  );
}
