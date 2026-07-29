import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { MICRONUTRIENTS, MICRO_GROUPS, formatAmount, percentDv } from "@/lib/nutrition";
import type { MicroValues } from "@/lib/types";

/**
 * Collapsible micronutrient readout for a day's diary: eaten amount vs adult
 * daily value per nutrient. Null totals mean no logged food carried data for
 * that nutrient — shown as "no data", never as zero.
 */
export function MicroPanel({ totals }: { totals: MicroValues }) {
  return (
    <details className="group rounded-2xl border border-ink-800 bg-ink-900/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="font-display text-base font-semibold text-paper">Micronutrients</h2>
          <p className="text-[11px] text-paper-mute">% of adult daily value, from foods with full profiles</p>
        </div>
        <CaretRight
          weight="bold"
          className="size-4 shrink-0 text-paper-mute transition-transform group-open:rotate-90"
        />
      </summary>
      <div className="space-y-5 border-t border-ink-800 px-5 py-4">
        {MICRO_GROUPS.map(({ group, keys }) => (
          <section key={group}>
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
              {group}
            </h3>
            <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {keys.map((key) => {
                const def = MICRONUTRIENTS[key];
                const value = totals[key];
                const pct = value != null ? percentDv(key, value) : null;
                const over = def.limit && pct != null && pct >= 100;
                return (
                  <li key={key} className="text-xs">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-paper-dim">{def.label}</span>
                      {value == null ? (
                        <span className="text-paper-mute">no data</span>
                      ) : (
                        <span className="font-mono text-paper tabular">
                          {formatAmount(value)}
                          {def.dv != null ? ` / ${formatAmount(def.dv)}` : ""} {def.unit}
                          {pct != null && (
                            <span className={over ? "text-danger" : "text-paper-mute"}> · {pct}%</span>
                          )}
                        </span>
                      )}
                    </div>
                    {def.dv != null && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-700">
                        <div
                          className={`h-full rounded-full ${over ? "bg-danger" : "bg-lime"}`}
                          style={{ width: `${value == null ? 0 : Math.min((value / def.dv) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
