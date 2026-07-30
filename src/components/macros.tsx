import type { Macros } from "@/lib/nutrition";
import { CountUp } from "@/components/motion/count-up";
import { DrawnBar, DrawnRing } from "@/components/motion/progress";
import { Reveal } from "@/components/motion/reveal";

/** Big calorie ring for the dashboard hero — GSAP-drawn with counted center. */
export function CalorieRing({
  eaten,
  target,
}: {
  eaten: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0;
  const over = eaten > target;

  return (
    <div className="relative size-40 shrink-0">
      <DrawnRing
        pct={pct}
        radius={64}
        stroke={10}
        color={over ? "var(--danger)" : "var(--lime)"}
        className="size-full"
        delay={0.15}
      />
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="font-mono text-2xl font-semibold tracking-tight text-paper tabular">
            <CountUp value={Math.round(eaten)} />
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
    <Reveal className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.09}>
      {MACRO_META.map(([key, label, color], i) => {
        const value = eaten[key];
        const target = targets[key];
        const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
        return (
          <div
            key={key}
            data-reveal
            className="card-lift rounded-xl border border-ink-800 bg-ink-900/60 px-4 py-3.5"
          >
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-paper-dim">{label}</p>
              <p className="font-mono text-xs text-paper-mute tabular">
                <CountUp value={Math.round(value)} /> / {Math.round(target)} g
              </p>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
              <DrawnBar pct={pct} delay={0.2 + i * 0.1} className={color} />
            </div>
          </div>
        );
      })}
    </Reveal>
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
