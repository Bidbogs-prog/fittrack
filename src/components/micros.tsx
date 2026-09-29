import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { MICRONUTRIENTS, MICRO_GROUPS, formatAmount, percentDv } from "@/lib/nutrition";
import { MICRO_KEYS, type MicroValues } from "@/lib/types";
import { LOW_DV_PCT } from "./micros-shared";


/**
 * Collapsible micronutrient readout for a day's diary: eaten amount vs adult
 * daily value per nutrient. Null totals mean no logged food carried data for
 * that nutrient — shown as "no data", never as zero. The summary line calls
 * out the lowest nutrients so the rail stays one card tall.
 */
export async function MicroPanel({ totals }: { totals: MicroValues }) {
  const t = await getTranslations("micros");

  const known = MICRO_KEYS.flatMap((key) => {
    const def = MICRONUTRIENTS[key];
    const value = totals[key];
    if (value == null || def.dv == null || def.limit) return [];
    const pct = percentDv(key, value);
    return pct == null ? [] : [{ key, label: def.label, pct }];
  }).sort((a, b) => a.pct - b.pct);
  const highlights = known.slice(0, 3);

  return (
    <details className="group @container rounded-[18px] border border-ink-800 bg-ink-900">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3.5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 text-[13px]">
          <h2 className="font-medium text-paper">{t("title")}</h2>
          <p className="mt-1 leading-relaxed text-paper-mute">
            {highlights.length === 0
              ? t("noData")
              : highlights.map((h, i) => (
                  <span key={h.key} className={h.pct < LOW_DV_PCT ? "text-danger" : undefined}>
                    {i > 0 && <span className="text-paper-mute"> · </span>}
                    {h.label} {h.pct}%
                  </span>
                ))}
            <span className="text-paper-mute"> · {t("all", { count: MICRO_KEYS.length })}</span>
          </p>
        </div>
        <CaretRight
          weight="bold"
          className="mt-0.5 size-4 shrink-0 text-paper-mute transition-transform group-open:rotate-90 rtl:-scale-x-100 rtl:group-open:rotate-90"
        />
      </summary>
      <div className="space-y-5 border-t border-ink-800 px-3.5 py-4">
        <p className="text-[11px] text-paper-mute">{t("hint")}</p>
        {MICRO_GROUPS.map(({ group, keys }) => (
          <section key={group}>
            <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
              {group}
            </h3>
            <ul className="grid gap-x-6 gap-y-2.5 @lg:grid-cols-2 @3xl:grid-cols-3">
              {keys.map((key) => {
                const def = MICRONUTRIENTS[key];
                const value = totals[key];
                const pct = value != null ? percentDv(key, value) : null;
                const over = def.limit && pct != null && pct >= 100;
                const low = !def.limit && pct != null && pct < LOW_DV_PCT;
                return (
                  <li key={key} className="text-xs">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-paper-dim">{def.label}</span>
                      {value == null ? (
                        <span className="text-paper-mute">{t("unknown")}</span>
                      ) : (
                        <span className="font-mono text-paper tabular">
                          {formatAmount(value)} {def.unit}
                          {pct != null && (
                            <span className={over || low ? "text-danger" : "text-paper-mute"}> · {pct}%</span>
                          )}
                        </span>
                      )}
                    </div>
                    {def.dv != null && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-800">
                        <div
                          className={`h-full rounded-full ${over || low ? "bg-danger" : "bg-fibre"}`}
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
