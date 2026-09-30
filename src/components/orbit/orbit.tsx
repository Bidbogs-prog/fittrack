"use client";

import { useEffect, useId, useState } from "react";
import { C, dash, pointAt, windowArc, type OrbitWindow } from "./orbit-math";

export type { OrbitWindow };

/**
 * The orbit: a 24-hour dial of the day (Design README, "<Orbit>").
 *
 * - Hour ticks at r=114, eating window as a lit flame arc at r=106.
 * - Protein / carbs / fat as three inner rings (r=90/77/64), start at
 *   12 o'clock, fill = eaten / target clamped to 1.
 * - Meals are dots on r≈106 at the time they were eaten (00 at the top,
 *   clockwise). Fresh dots are flame and spring in.
 *
 * Pure presentation: callers compute minutes-of-day (usually client-side,
 * since only the browser knows the viewer's local time). Children render
 * in the centre disc. In RTL only the SVG mirrors; the centre stays put.
 */

export interface OrbitDot {
  key: string;
  minutes: number;
  fresh?: boolean;
}

const RINGS = [
  { r: 90, color: "var(--protein)" },
  { r: 77, color: "var(--carbs)" },
  { r: 64, color: "var(--fat)" },
] as const;

export function Orbit({
  rings,
  window: win,
  dots = [],
  now,
  ghost = false,
  labels = true,
  spinTicks = false,
  dotRadius = 7,
  summary,
  className = "size-[280px]",
  children,
}: {
  /** Protein, carbs, fat as fractions of target; omit to hide the rings. */
  rings?: [number, number, number];
  window?: OrbitWindow | null;
  dots?: OrbitDot[];
  /** Minute-of-day for the "now" marker; null hides it. */
  now?: number | null;
  /** Dashed inner ring: a ghost of today's orbit for comparison. */
  ghost?: boolean;
  labels?: boolean;
  spinTicks?: boolean;
  dotRadius?: number;
  /** Text summary for assistive tech (the dial is role="img"). */
  summary: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const gid = useId().replace(/:/g, "");
  // Rings draw in from zero after mount; SSR paints them empty.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const arc = win ? windowArc(win) : null;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <svg
        viewBox="0 0 240 240"
        role="img"
        aria-label={summary}
        className="absolute inset-0 size-full overflow-visible rtl:-scale-x-100"
      >
        <defs>
          <linearGradient id={`fg-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--flame-glow)" />
            <stop offset=".5" stopColor="var(--flame)" />
            <stop offset="1" stopColor="var(--flame-deep)" />
          </linearGradient>
        </defs>

        <g className={spinTicks ? "spin-60" : undefined}>
          <circle
            cx="120"
            cy="120"
            r="114"
            fill="none"
            stroke="var(--ink-600)"
            strokeWidth="4.5"
            strokeDasharray="1 28.84"
          />
        </g>

        <circle cx="120" cy="120" r="106" fill="none" stroke="var(--ink-800)" strokeWidth="5" />
        {arc && (
          <circle
            cx="120"
            cy="120"
            r="106"
            fill="none"
            stroke={`url(#fg-${gid})`}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${arc.length} ${C(106)}`}
            transform={`rotate(${arc.rotate} 120 120)`}
          />
        )}

        {ghost && (
          <circle
            cx="120"
            cy="120"
            r="86"
            fill="none"
            stroke="var(--ink-700)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        )}

        {rings &&
          RINGS.map(({ r, color }, i) => (
            <g key={r}>
              <circle cx="120" cy="120" r={r} fill="none" stroke="var(--ink-800)" strokeWidth="9" />
              <circle
                cx="120"
                cy="120"
                r={r}
                fill="none"
                stroke={color}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={dash(drawn ? rings[i] : 0, r)}
                transform="rotate(-90 120 120)"
                className="orbit-arc"
                style={{ transitionDelay: `${i * 80}ms`, opacity: rings[i] > 0 || !drawn ? 1 : 0 }}
              />
            </g>
          ))}

        {dots.map((d) => {
          const p = pointAt(d.minutes, 106);
          return (
            <circle
              key={d.key}
              cx={p.x}
              cy={p.y}
              r={dotRadius}
              fill={d.fresh ? "var(--flame)" : "var(--paper)"}
              stroke="var(--ink-950)"
              strokeWidth="3"
              className={d.fresh ? "orbit-dot-new" : undefined}
            />
          );
        })}

        {now != null &&
          (() => {
            const p = pointAt(now, 106);
            return (
              <circle
                cx={p.x}
                cy={p.y}
                r="5"
                fill="var(--ink-950)"
                stroke="var(--flame-glow)"
                strokeWidth="2.5"
              />
            );
          })()}
      </svg>

      {labels && (
        <div aria-hidden className="pointer-events-none font-mono text-[9px] font-medium text-paper-mute">
          <span className="absolute -top-2 left-1/2 -translate-x-1/2">00</span>
          <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2">12</span>
          <span className="absolute top-1/2 -end-3 -translate-y-1/2">06</span>
          <span className="absolute top-1/2 -start-3.5 -translate-y-1/2">18</span>
        </div>
      )}

      {children}
    </div>
  );
}

/**
 * A single-ring mini dial (history days, plan cards, the coach header).
 * viewBox 0 0 48 48, ring at r=18.
 */
export function MiniDial({
  fraction,
  color = "var(--flame)",
  size = 40,
  stroke = 5,
  today = false,
  label,
  children,
}: {
  /** null = nothing logged: an empty track. */
  fraction: number | null;
  color?: string;
  size?: number;
  stroke?: number;
  /** Dashed glow ring marking the current day. */
  today?: boolean;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className="absolute inset-0"
      >
        {today && (
          <circle cx="24" cy="24" r="22" fill="none" stroke="var(--flame-glow)" strokeWidth="1" strokeDasharray="2 3" />
        )}
        <circle cx="24" cy="24" r="17" fill="none" stroke="var(--ink-800)" strokeWidth={stroke} />
        {fraction != null && fraction > 0 && (
          <circle
            cx="24"
            cy="24"
            r="17"
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={dash(fraction, 17)}
            transform="rotate(-90 24 24)"
          />
        )}
      </svg>
      {children && <span className="relative">{children}</span>}
    </span>
  );
}

