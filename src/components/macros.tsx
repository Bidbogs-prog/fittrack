import { getFormatter, getTranslations } from "next-intl/server";
import type { Macros } from "@/lib/nutrition";
import { DrawnBar } from "@/components/motion/progress";

const MACRO_META = [
  ["protein", "bg-protein"],
  ["carbs", "bg-carbs"],
  ["fat", "bg-fat"],
  ["fibre", "bg-fibre"],
] as const;

/** Right-rail macro bars: eaten vs target grams, fibre included. */
export async function MacroBars({ eaten, targets }: { eaten: Macros; targets: Macros }) {
  const t = await getTranslations("macros");
  return (
    <section aria-labelledby="macros-heading" className="flex flex-col gap-2.5">
      <h2 id="macros-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
        {t("title")}
      </h2>
      {MACRO_META.map(([key, color], i) => {
        const value = eaten[key];
        const target = targets[key];
        const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-paper">{t(key)}</span>
              <span className="font-mono text-paper-dim tabular">
                {Math.round(value)} / {Math.round(target)} g
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={t(key)}
              aria-valuenow={Math.round(value)}
              aria-valuemin={0}
              aria-valuemax={Math.round(target)}
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-800"
            >
              <DrawnBar pct={pct} delay={0.1 + i * 0.08} className={color} />
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Three compact macro tiles under the dial on mobile. */
export async function MacroTiles({ eaten, targets }: { eaten: Macros; targets: Macros }) {
  const t = await getTranslations("macros");
  return (
    <dl className="grid grid-cols-3 gap-2">
      {(
        [
          ["protein", "bg-protein"],
          ["carbs", "bg-carbs"],
          ["fat", "bg-fat"],
        ] as const
      ).map(([key, color]) => (
        <div key={key} className="rounded-[14px] border border-ink-800 bg-ink-900 px-2.5 py-2">
          <dt className="flex items-center gap-1.5 text-[11px] text-paper-mute">
            <span className={`size-1.5 rounded-full ${color}`} />
            {t(key)}
          </dt>
          <dd className="mt-0.5 font-mono text-sm font-medium text-paper tabular">
            {Math.round(eaten[key])}
            <span className="text-paper-mute">/{Math.round(targets[key])}</span>
          </dd>
        </div>
      ))}
    </dl>
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
