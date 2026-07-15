"use client";

import { useRef } from "react";
import { DUR, EASE, NOT_REDUCED, gsap, useGSAP } from "./gsap";

/**
 * SVG arc that draws itself to `pct` (0..1) when it enters the viewport.
 * Pure presentation — pass precomputed geometry from the server.
 */
export function DrawnRing({
  pct,
  radius,
  stroke,
  color,
  trackColor = "var(--ink-700)",
  className,
  delay = 0,
}: {
  pct: number;
  radius: number;
  stroke: number;
  color: string;
  trackColor?: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<SVGCircleElement>(null);
  const size = (radius + stroke) * 2;
  const c = 2 * Math.PI * radius;
  const target = c * (1 - Math.min(Math.max(pct, 0), 1));

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(NOT_REDUCED, () => {
        gsap.fromTo(
          el,
          { strokeDashoffset: c },
          {
            strokeDashoffset: target,
            duration: DUR.hero,
            delay,
            ease: EASE.emphasis,
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          },
        );
      });
    },
    { dependencies: [target], revertOnUpdate: true },
  );

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={`-rotate-90 ${className ?? ""}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={stroke}
      />
      <circle
        ref={ref}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={target}
      />
    </svg>
  );
}

/**
 * Horizontal progress fill that scales in from the left on scroll.
 * Width is set server-side; only transform animates (GPU-safe).
 */
export function DrawnBar({
  pct,
  className,
  delay = 0,
}: {
  pct: number; // 0..100
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(NOT_REDUCED, () => {
        gsap.fromTo(
          el,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: DUR.hero,
            delay,
            ease: EASE.emphasis,
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
          },
        );
      });
    },
    { dependencies: [pct], revertOnUpdate: true },
  );

  return (
    <div
      ref={ref}
      className={`h-full origin-left rounded-full ${className ?? ""}`}
      style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
    />
  );
}
