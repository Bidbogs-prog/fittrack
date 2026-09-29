"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { TrendDown, TrendUp } from "@phosphor-icons/react";
import { track } from "@/lib/analytics";
import { displayWeight, inputWeightToKg, weightUnit } from "@/lib/units";
import type { Units } from "@/lib/types";
import type { TrendPoint } from "@/lib/weight";
import { logWeight } from "./actions";

function Sparkline({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null;
  const w = 240;
  const h = 56;
  const values = points.map((p) => p.trend);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xy = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - 6 - ((p.trend - min) / span) * (h - 14);
    return [x, y] as const;
  });
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 h-14 w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--flame)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--flame)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#wfill)" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--flame)"
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
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
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
  const [open, setOpen] = useState(false);
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
      if (!res?.error) {
        track("weight_logged", {});
        setOpen(false);
      }
    });
  }

  const falling = delta != null && delta < 0;

  return (
    <section className="rounded-[18px] border border-ink-800 bg-ink-900 p-3.5">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <h2 className="font-medium text-paper">{t("weightTrend")}</h2>
        {delta != null && (
          <span
            className={`inline-flex items-center gap-1 font-mono text-xs tabular ${
              falling ? "text-fibre" : "text-paper-dim"
            }`}
          >
            {falling ? (
              <TrendDown weight="bold" className="size-3.5" />
            ) : (
              <TrendUp weight="bold" className="size-3.5" />
            )}
            {delta >= 0 ? "+" : ""}
            {t("weightDelta", { value: displayWeight(delta, units).toFixed(1), unit })}
          </span>
        )}
      </div>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-[-0.03em] text-paper tabular">
        {last ? displayWeight(last.trend, units).toFixed(1) : "—"}
        <span className="text-[13px] font-normal text-paper-mute"> {unit}</span>
      </p>
      {last ? (
        <Sparkline points={points.slice(-30)} />
      ) : (
        <p className="mt-1.5 text-xs text-paper-mute">{t("weightEmpty")}</p>
      )}

      {open ? (
        <form onSubmit={submit} className="mt-3 flex items-center gap-2">
          <label htmlFor="weight_kg" className="sr-only">
            {isToday ? t("weighInToday") : t("weighInOnDate", { date })}
          </label>
          <input
            id="weight_kg"
            type="number"
            inputMode="decimal"
            autoFocus
            min={units === "imperial" ? 55 : 25}
            max={units === "imperial" ? 880 : 400}
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={unit}
            className="field min-w-0 flex-1 tabular"
          />
          <button
            type="submit"
            disabled={pending || !(inputKg >= 25 && inputKg <= 400)}
            className="btn-flame btn-press rounded-xl px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? tCommon("saving") : logged ? t("update") : tCommon("log")}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-tint btn-press mt-3 inline-flex min-h-9 items-center rounded-full px-3.5 text-xs font-medium"
        >
          {logged
            ? t("loggedWeightEdit", { value: displayWeight(logged.weight, units).toFixed(1), unit })
            : isToday
              ? t("logTodayWeight")
              : t("logWeightFor", { date })}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  );
}
