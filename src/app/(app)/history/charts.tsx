"use client";

import { useRef, useState } from "react";
import type { TrendPoint } from "@/lib/weight";

/**
 * Dependency-free SVG charts for /history. Marks follow the app's entity
 * tokens (lime = energy, protein/carbs/fat as everywhere else in the UI);
 * identity is never color-alone — every multi-series chart has a legend,
 * direct end labels and a hover tooltip. Static SVG: nothing animates, so
 * prefers-reduced-motion needs no special casing.
 */

export interface DayStat {
  date: string;
  /** null = nothing logged that day (a gap, not a zero). */
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

const W = 640;
const H = 220;
const PAD = { l: 40, r: 14, t: 12, b: 24 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

function shortDate(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function niceMax(value: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  return Math.ceil(value / pow) * pow;
}

/** Map pointer x to a slot index across the plot width. */
function usePointerIndex(n: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState<number | null>(null);

  function onPointerMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((x - PAD.l) / PLOT_W) * (n - 1));
    setIdx(i >= 0 && i < n ? i : null);
  }

  return { ref, idx, onPointerMove, onPointerLeave: () => setIdx(null) };
}

function Tooltip({
  idx,
  n,
  title,
  rows,
}: {
  idx: number;
  n: number;
  title: string;
  rows: { label: string; value: string; swatch?: string }[];
}) {
  const leftPct = ((PAD.l + (idx / Math.max(1, n - 1)) * PLOT_W) / W) * 100;
  const flip = idx > n / 2;
  return (
    <div
      className="pointer-events-none absolute top-1 z-10 min-w-32 rounded-lg border border-ink-700 bg-ink-950/95 px-3 py-2 shadow-[0_12px_24px_-8px_rgba(0,0,0,0.8)]"
      style={{
        left: `${leftPct}%`,
        transform: flip ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-paper-mute">{title}</p>
      <dl className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-[11px]">
            <dt className="flex items-center gap-1.5 text-paper-dim">
              {row.swatch && (
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ background: row.swatch }}
                />
              )}
              {row.label}
            </dt>
            <dd className="font-mono text-paper tabular">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Frame({
  yTicks,
  xLabels,
  children,
}: {
  yTicks: { y: number; label: string }[];
  xLabels: { x: number; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {yTicks.map((tick) => (
        <g key={tick.label}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={tick.y}
            y2={tick.y}
            stroke="var(--color-ink-800)"
            strokeWidth="1"
          />
          <text
            x={PAD.l - 6}
            y={tick.y + 3}
            textAnchor="end"
            fontSize="9"
            fill="var(--color-paper-mute)"
          >
            {tick.label}
          </text>
        </g>
      ))}
      {xLabels.map((tick) => (
        <text
          key={tick.label + tick.x}
          x={tick.x}
          y={H - 8}
          textAnchor="middle"
          fontSize="9"
          fill="var(--color-paper-mute)"
        >
          {tick.label}
        </text>
      ))}
      {children}
    </svg>
  );
}

function xFor(i: number, n: number): number {
  return PAD.l + (n === 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W);
}

function buildXLabels(dates: string[]): { x: number; label: string }[] {
  const step = Math.max(1, Math.ceil(dates.length / 5));
  const labels: { x: number; label: string }[] = [];
  for (let i = 0; i < dates.length; i += step) {
    labels.push({ x: xFor(i, dates.length), label: shortDate(dates[i]) });
  }
  return labels;
}

// ---------- Calories vs target ----------

export function CalorieChart({ days, target }: { days: DayStat[]; target: number }) {
  const { ref, idx, onPointerMove, onPointerLeave } = usePointerIndex(days.length);
  const max = niceMax(Math.max(target * 1.25, ...days.map((d) => d.kcal ?? 0)));
  const yFor = (v: number) => PAD.t + PLOT_H - (v / max) * PLOT_H;
  const slot = PLOT_W / Math.max(1, days.length);
  const barW = Math.max(4, slot - 2); // 2px surface gap between fills

  const hovered = idx != null ? days[idx] : null;

  return (
    <div
      ref={ref}
      className="relative"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <Frame
        yTicks={[0, max / 2, max].map((v) => ({ y: yFor(v), label: String(Math.round(v)) }))}
        xLabels={buildXLabels(days.map((d) => d.date))}
      >
        {days.map((d, i) => {
          if (d.kcal == null) return null;
          const y = yFor(d.kcal);
          const x = PAD.l + i * slot + (slot - barW) / 2;
          return (
            <rect
              key={d.date}
              x={x}
              y={Math.min(y, PAD.t + PLOT_H - 1)}
              width={barW}
              height={Math.max(1, PAD.t + PLOT_H - y)}
              rx="2"
              fill="var(--color-lime)"
              opacity={idx == null || idx === i ? 0.9 : 0.45}
            />
          );
        })}
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={yFor(target)}
          y2={yFor(target)}
          stroke="var(--color-paper-mute)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <text
          x={W - PAD.r}
          y={yFor(target) - 4}
          textAnchor="end"
          fontSize="9"
          fill="var(--color-paper-dim)"
        >
          target {target}
        </text>
      </Frame>
      {hovered && idx != null && (
        <Tooltip
          idx={idx}
          n={days.length}
          title={shortDate(hovered.date)}
          rows={
            hovered.kcal == null
              ? [{ label: "logged", value: "—" }]
              : [
                  { label: "eaten", value: `${Math.round(hovered.kcal)} kcal`, swatch: "var(--color-lime)" },
                  {
                    label: "vs target",
                    value: `${hovered.kcal >= target ? "+" : ""}${Math.round(hovered.kcal - target)}`,
                  },
                ]
          }
        />
      )}
    </div>
  );
}

// ---------- Macro trend ----------

const MACRO_SERIES = [
  { key: "protein", label: "Protein", color: "var(--color-protein)" },
  { key: "carbs", label: "Carbs", color: "var(--color-carbs)" },
  { key: "fat", label: "Fat", color: "var(--color-fat)" },
] as const;

/** Split logged days into consecutive runs so gaps stay gaps, not lines. */
function seriesPaths(
  days: DayStat[],
  key: (typeof MACRO_SERIES)[number]["key"],
  yFor: (v: number) => number
): string[] {
  const paths: string[] = [];
  let current: string[] = [];
  days.forEach((d, i) => {
    const value = d[key];
    if (value == null) {
      if (current.length > 1) paths.push(current.join(" "));
      current = [];
      return;
    }
    const x = xFor(i, days.length);
    current.push(`${current.length === 0 ? "M" : "L"}${x.toFixed(1)} ${yFor(value).toFixed(1)}`);
  });
  if (current.length > 1) paths.push(current.join(" "));
  return paths;
}

export function MacroChart({ days }: { days: DayStat[] }) {
  const { ref, idx, onPointerMove, onPointerLeave } = usePointerIndex(days.length);
  const max = niceMax(
    Math.max(10, ...days.flatMap((d) => [d.protein ?? 0, d.carbs ?? 0, d.fat ?? 0]))
  );
  const yFor = (v: number) => PAD.t + PLOT_H - (v / max) * PLOT_H;
  const hovered = idx != null ? days[idx] : null;

  const lastLogged = [...days].reverse().find((d) => d.kcal != null);

  return (
    <div>
      <div className="flex flex-wrap gap-4 px-1" aria-hidden="false">
        {MACRO_SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-paper-dim">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div
        ref={ref}
        className="relative mt-2"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <Frame
          yTicks={[0, max / 2, max].map((v) => ({ y: yFor(v), label: `${Math.round(v)}g` }))}
          xLabels={buildXLabels(days.map((d) => d.date))}
        >
          {MACRO_SERIES.map((s) =>
            seriesPaths(days, s.key, yFor).map((d, i) => (
              <path
                key={`${s.key}-${i}`}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))
          )}
          {/* direct end labels so identity survives without the legend */}
          {lastLogged &&
            MACRO_SERIES.map((s) => {
              const value = lastLogged[s.key];
              if (value == null) return null;
              return (
                <text
                  key={`label-${s.key}`}
                  x={xFor(days.indexOf(lastLogged), days.length) + 4}
                  y={yFor(value) + 3}
                  fontSize="9"
                  fill="var(--color-paper-dim)"
                >
                  {s.label[0]}
                </text>
              );
            })}
          {idx != null && (
            <line
              x1={xFor(idx, days.length)}
              x2={xFor(idx, days.length)}
              y1={PAD.t}
              y2={PAD.t + PLOT_H}
              stroke="var(--color-ink-600)"
              strokeWidth="1"
            />
          )}
        </Frame>
        {hovered && idx != null && (
          <Tooltip
            idx={idx}
            n={days.length}
            title={shortDate(hovered.date)}
            rows={
              hovered.kcal == null
                ? [{ label: "logged", value: "—" }]
                : MACRO_SERIES.map((s) => ({
                    label: s.label,
                    value: `${Math.round(hovered[s.key] ?? 0)} g`,
                    swatch: s.color,
                  }))
            }
          />
        )}
      </div>
    </div>
  );
}

// ---------- Weight ----------

export function WeightChart({ points }: { points: TrendPoint[] }) {
  const { ref, idx, onPointerMove, onPointerLeave } = usePointerIndex(points.length);
  const values = points.flatMap((p) => [p.weight, p.trend]);
  const min = Math.floor(Math.min(...values) - 0.5);
  const max = Math.ceil(Math.max(...values) + 0.5);
  const span = max - min || 1;
  const yFor = (v: number) => PAD.t + PLOT_H - ((v - min) / span) * PLOT_H;
  const hovered = idx != null ? points[idx] : null;

  const trendPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i, points.length).toFixed(1)} ${yFor(p.trend).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <div className="flex flex-wrap gap-4 px-1">
        <span className="flex items-center gap-1.5 text-[11px] text-paper-dim">
          <span className="size-2 rounded-full bg-lime" />
          Trend (smoothed)
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-paper-dim">
          <span className="size-2 rounded-full border border-paper-mute" />
          Scale weight
        </span>
      </div>
      <div
        ref={ref}
        className="relative mt-2"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <Frame
          yTicks={[min, (min + max) / 2, max].map((v) => ({
            y: yFor(v),
            label: `${Math.round(v * 10) / 10}`,
          }))}
          xLabels={buildXLabels(points.map((p) => p.date))}
        >
          {points.map((p, i) => (
            <circle
              key={p.date}
              cx={xFor(i, points.length)}
              cy={yFor(p.weight)}
              r="4"
              fill="var(--color-ink-900)"
              stroke="var(--color-paper-mute)"
              strokeWidth="1.5"
            />
          ))}
          <path
            d={trendPath}
            fill="none"
            stroke="var(--color-lime)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {idx != null && (
            <line
              x1={xFor(idx, points.length)}
              x2={xFor(idx, points.length)}
              y1={PAD.t}
              y2={PAD.t + PLOT_H}
              stroke="var(--color-ink-600)"
              strokeWidth="1"
            />
          )}
        </Frame>
        {hovered && idx != null && (
          <Tooltip
            idx={idx}
            n={points.length}
            title={shortDate(hovered.date)}
            rows={[
              { label: "Trend", value: `${hovered.trend.toFixed(1)} kg`, swatch: "var(--color-lime)" },
              { label: "Scale", value: `${hovered.weight.toFixed(1)} kg` },
            ]}
          />
        )}
      </div>
    </div>
  );
}
