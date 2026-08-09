"use client";

import { useState, useTransition } from "react";
import { TrendDown, TrendUp } from "@phosphor-icons/react";
import { track } from "@/lib/analytics";
import { displayWeight, inputWeightToKg, weightUnit } from "@/lib/units";
import type { Units } from "@/lib/types";
import type { TrendPoint } from "@/lib/weight";
import { logWeight } from "./actions";

function Sparkline({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null;
  const w = 240;
  const h = 40;
  const values = points.map((p) => p.trend);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - 4 - ((p.trend - min) / span) * (h - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-3 h-10 w-full max-w-60"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <polyline
        points={coords}
        fill="none"
        stroke="var(--color-lime)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function WeightCard({
  points,
  delta,
  date,
  isToday,
  defaultWeight,
  units = "metric",
}: {
  /** EWMA trend points, oldest first. Always kg — display converts. */
  points: TrendPoint[];
  /** Trend change over the trailing week, kg. */
  delta: number | null;
  /** The diary date being viewed — weigh-ins land on that date. */
  date: string;
  isToday: boolean;
  defaultWeight: number | null;
  units?: Units;
}) {
  const unit = weightUnit(units);
  const logged = points.find((p) => p.date === date) ?? null;
  const last = points[points.length - 1] ?? null;
  // The input works in display units; storage stays kg.
  const [weight, setWeight] = useState(
    logged
      ? String(displayWeight(logged.weight, units))
      : defaultWeight
        ? String(displayWeight(defaultWeight, units))
        : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const inputKg = inputWeightToKg(Number(weight) || 0, units);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("date", date);
    fd.set("weight_kg", String(inputKg));
    startTransition(async () => {
      const res = await logWeight(fd);
      setError(res?.error ?? null);
      if (!res?.error) track("weight_logged", {});
    });
  }

  const falling = delta != null && delta < 0;

  return (
    <section className="grid gap-5 rounded-2xl border border-ink-800 bg-ink-900/60 p-5 sm:grid-cols-[1fr_auto] sm:items-center lg:p-6">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
          Weight trend
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-2xl font-semibold tracking-tight text-paper tabular">
            {last ? `${displayWeight(last.trend, units).toFixed(1)} ${unit}` : "—"}
          </span>
          {delta != null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs tabular ${
                falling ? "bg-lime/10 text-lime" : "bg-ink-800 text-paper-dim"
              }`}
            >
              {falling ? (
                <TrendDown weight="bold" className="size-3.5" />
              ) : (
                <TrendUp weight="bold" className="size-3.5" />
              )}
              {delta >= 0 ? "+" : ""}
              {displayWeight(delta, units).toFixed(1)} {unit} / 7d
            </span>
          )}
        </div>
        {last ? (
          <Sparkline points={points.slice(-30)} />
        ) : (
          <p className="mt-2 text-sm text-paper-mute">
            Log your first weigh-in — the smoothed trend beats any single scale reading.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="flex items-end gap-2">
        <div className="space-y-2">
          <label htmlFor="weight_kg" className="field-label">
            {isToday ? "Today's weigh-in" : `Weigh-in · ${date}`}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="weight_kg"
              type="number"
              inputMode="decimal"
              min={units === "imperial" ? 55 : 25}
              max={units === "imperial" ? 880 : 400}
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={unit}
              className="field w-28 tabular"
            />
            <button
              type="submit"
              disabled={pending || !(inputKg >= 25 && inputKg <= 400)}
              className="btn-press rounded-xl bg-lime px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Saving…" : logged ? "Update" : "Log"}
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </form>
    </section>
  );
}
