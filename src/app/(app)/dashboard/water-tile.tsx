"use client";

import { useState, useTransition } from "react";
import { Drop, Minus, Plus } from "@phosphor-icons/react";
import { logWater } from "./actions";

/**
 * Water tile with optimistic taps: the count moves instantly, the server
 * settles it via the atomic log_water RPC, and a failed write rolls the
 * count back with a visible error instead of silently doing nothing.
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
  const [ml, setMl] = useState(serverMl);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Re-sync when the server value changes (day switch, revalidation) —
  // state adjusted during render, per React's derived-state guidance.
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
  const litres = (v: number) => (v / 1000).toFixed(v % 1000 === 0 ? 0 : 2);

  return (
    <div className="col-span-2 rounded-2xl border border-ink-800 bg-ink-900/60 p-4 lg:col-span-1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
            <Drop weight="fill" className={`size-3.5 ${pct >= 100 ? "text-flame" : ""}`} />
            Water
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-paper tabular">
            {litres(ml)}
            <span className="ml-1.5 text-sm font-normal text-paper-mute">/ {litres(target)} L</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => add(-250)}
            disabled={ml <= 0}
            aria-label="Remove a 250 ml glass"
            className="btn-press rounded-lg border border-ink-700 p-2 text-paper-mute transition-colors hover:text-paper disabled:opacity-30 pointer-coarse:p-3"
          >
            <Minus weight="bold" className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => add(250)}
            aria-label="Add a 250 ml glass"
            className="btn-press rounded-lg border border-ink-700 p-2 text-paper-dim transition-colors hover:border-flame/50 hover:text-flame pointer-coarse:p-3"
          >
            <Plus weight="bold" className="size-3.5" />
          </button>
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuenow={ml}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label="Water drunk"
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-800"
      >
        <div
          className="h-full rounded-full bg-flame transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {error && <p className="mt-2 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
