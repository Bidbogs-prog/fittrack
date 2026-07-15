"use client";

import { useRef } from "react";
import { EASE, NOT_REDUCED, gsap, useGSAP } from "./gsap";

function format(v: number, decimals: number): string {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Animated numeral. Server-renders the final value (SEO / no-JS safe),
 * then counts up from 0 when scrolled into view.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 1.3,
  delay = 0,
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(NOT_REDUCED, () => {
        const state = { v: 0 };
        el.textContent = format(0, decimals);
        gsap.to(state, {
          v: value,
          duration,
          delay,
          ease: EASE.emphasis,
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
          onUpdate: () => {
            el.textContent = format(state.v, decimals);
          },
          onComplete: () => {
            el.textContent = format(value, decimals);
          },
        });
      });
    },
    { dependencies: [value, decimals], revertOnUpdate: true },
  );

  return (
    <span ref={ref} className={className}>
      {format(value, decimals)}
    </span>
  );
}
