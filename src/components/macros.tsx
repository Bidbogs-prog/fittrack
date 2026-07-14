import type { Macros } from "@/lib/nutrition";

/** Big SVG calorie ring for the dashboard hero. Pure server component. */
export function CalorieRing({
  eaten,
  target,
}: {
  eaten: number;
  target: number;
}) {
  const r = 64;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0;
  const over = eaten > target;

  return (
    <div className="relative size-40 shrink-0">
      <svg viewBox="0 0 160 160" className="size-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--ink-700)" strokeWidth="10" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={over ? "var(--danger)" : "var(--lime)"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="font-mono text-2xl font-semibold tracking-tight text-paper tabular">
            {Math.round(eaten).toLocaleString()}
          </p>
          <p className="text-[11px] text-paper-mute">of {target.toLocaleString()} kcal</p>
        </div>
      </div>
    </div>
  );
}

const MACRO_META = [
  ["protein", "Protein", "bg-protein"],
  ["carbs", "Carbs", "bg-carbs"],
  ["fat", "Fat", "bg-fat"],
  ["fibre", "Fibre", "bg-fibre"],
] as const;

/** Four labelled progress bars: eaten vs target grams. */
export function MacroBars({ eaten, targets }: { eaten: Macros; targets: Macros }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {MACRO_META.map(([key, label, color]) => {
        const value = eaten[key];
        const target = targets[key];
        const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
        return (
          <div key={key} className="rounded-xl border border-ink-800 bg-ink-900/60 px-4 py-3.5">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-paper-dim">{label}</p>
              <p className="font-mono text-xs text-paper-mute tabular">
                {Math.round(value)} / {Math.round(target)} g
              </p>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
              <div
                className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Compact inline macro readout, e.g. under a food row. */
export function MacroInline({ macros }: { macros: Macros }) {
  return (
    <span className="font-mono text-[11px] text-paper-mute tabular">
      P {Math.round(macros.protein)} · C {Math.round(macros.carbs)} · F {Math.round(macros.fat)} · Fb{" "}
      {Math.round(macros.fibre)}
    </span>
  );
}
