import { getFormatter, getTranslations } from "next-intl/server";
import type { Macros } from "@/lib/nutrition";
import { CountUp } from "@/components/motion/count-up";
import { DrawnBar, DrawnRing } from "@/components/motion/progress";
import { Reveal } from "@/components/motion/reveal";

/** Big calorie ring for the dashboard hero — GSAP-drawn with counted center. */
export async function CalorieRing({
  eaten,
  target,
}: {
  eaten: number;
  target: number;
}) {
  const t = await getTranslations("common");
  const format = await getFormatter();
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0;
  const over = eaten > target;

  return (
    <div className="relative size-40 shrink-0">
      <DrawnRing
        pct={pct}
        radius={64}
        stroke={10}
        color={over ? "var(--danger)" : "var(--flame)"}
        className="size-full"
        delay={0.15}
      />
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="font-mono text-2xl font-semibold tracking-tight text-paper tabular">
            <CountUp value={Math.round(eaten)} />
          </p>
          <p className="text-[11px] text-paper-mute">
            {t("ofTargetKcal", { target: format.number(target) })}
          </p>
        </div>
      </div>
    </div>
  );
}

const MACRO_META = [
  ["protein", "bg-protein"],
  ["carbs", "bg-carbs"],
  ["fat", "bg-fat"],
  ["fibre", "bg-fibre"],
] as const;

/** Four labelled progress bars: eaten vs target grams. */
export async function MacroBars({ eaten, targets }: { eaten: Macros; targets: Macros }) {
  const t = await getTranslations("macros");
  return (
    <Reveal className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.09}>
      {MACRO_META.map(([key, color], i) => {
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
              <p className="text-xs font-medium text-paper-dim">{t(key)}</p>
              <p className="font-mono text-xs text-paper-mute tabular">
                <CountUp value={Math.round(value)} /> / {Math.round(target)} {t("grams")}
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
export async function MacroInline({ macros }: { macros: Macros }) {
  const t = await getTranslations("common");
  const format = await getFormatter();
  return (
    <span className="font-mono text-[11px] text-paper-mute tabular">
      {t("macroInline", {
        protein: format.number(Math.round(macros.protein)),
        carbs: format.number(Math.round(macros.carbs)),
        fat: format.number(Math.round(macros.fat)),
        fibre: format.number(Math.round(macros.fibre)),
      })}
    </span>
  );
}
