"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "@phosphor-icons/react";
import { logWater } from "./actions";

/**
 * Compact water tile with optimistic taps: the count moves instantly, the
 * server settles it via the atomic log_water RPC, and a failed write rolls
 * the count back with a visible error instead of silently doing nothing.
 */
export function WaterTile({
  ml: serverMl,
  target,
  date,
}: {
  ml: number;
  target: number;
  date: string;
}) {
  const t = useTranslations("habits");
  const [ml, setMl] = useState(serverMl);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Re-sync when the server value changes (day switch, revalidation, the
  // composer's "+250 ml" chip) — state adjusted during render.
  const [prevServerMl, setPrevServerMl] = useState(serverMl);
  if (prevServerMl !== serverMl) {
    setPrevServerMl(serverMl);
    setMl(serverMl);
  }

  function add(delta: number) {
    setError(null);
    const next = Math.min(20000, Math.max(0, ml + delta));
    const applied = next - ml;
    if (applied === 0) return;
    setMl(next);
    startTransition(async () => {
      const res = await logWater({ date, delta: applied });
      if (res.error) {
        setMl((v) => Math.min(20000, Math.max(0, v - applied)));
        setError(res.error);
      }
    });
  }

  const pct = Math.min(100, Math.round((ml / target) * 100));

  return (
    <div className="relative rounded-[14px] border border-ink-800 bg-ink-900 p-2.5" title={error ?? undefined}>
      <p className="text-[11px] text-paper-mute">{t("water")}</p>
      <p className="font-mono text-base font-medium text-carbs tabular">{(ml / 1000).toFixed(1)}L</p>
      <div className="mt-1 flex items-center gap-1">
        <button
          type="button"
          onClick={() => add(-250)}
          disabled={ml <= 0}
          aria-label={t("waterRemove")}
          className="btn-press grid size-7 place-items-center rounded-md border border-ink-700 text-paper-mute hover:text-paper disabled:opacity-30"
        >
          <Minus weight="bold" className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => add(250)}
          aria-label={t("waterAdd")}
          className="btn-press grid size-7 place-items-center rounded-md border border-ink-700 text-carbs hover:border-carbs/50"
        >
          <Plus weight="bold" className="size-3" />
        </button>
      </div>
      <div
        role="progressbar"
        aria-valuenow={ml}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={t("water")}
        className="absolute inset-x-2.5 bottom-1.5 h-0.5 overflow-hidden rounded-full bg-ink-800"
      >
        <div className="h-full rounded-full bg-carbs transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      {error && <p className="sr-only" role="alert">{error}</p>}
    </div>
  );
}
