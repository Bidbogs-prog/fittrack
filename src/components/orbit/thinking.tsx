"use client";

import { useEffect, useState } from "react";

/**
 * The AI "working" mark shared by the coach and the orbit composer: the
 * dial's ring with a flame arc, a satellite dot on a slower counter-orbit,
 * and status lines that step forward (holding on the last one). Static under
 * reduced motion (see .coach-* in globals.css).
 */
export function ThinkingOrbit({
  steps,
  size = 32,
  interval = 1700,
  className = "",
}: {
  steps: string[];
  size?: number;
  interval?: number;
  className?: string;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), interval);
    return () => window.clearInterval(id);
  }, [steps.length, interval]);

  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 32 32" width={size} height={size} className="shrink-0" aria-hidden>
        <defs>
          <linearGradient id="thinking-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffc94d" />
            <stop offset="1" stopColor="#f2701f" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="12" fill="none" stroke="var(--ink-800)" strokeWidth="2.5" />
        <g className="coach-orbit">
          <circle
            cx="16"
            cy="16"
            r="12"
            fill="none"
            stroke="url(#thinking-arc)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="22 54"
          />
        </g>
        <g className="coach-orbit-slow">
          <circle cx="16" cy="4" r="1.8" fill="var(--flame-glow)" />
        </g>
        <circle cx="16" cy="16" r="3" fill="var(--flame)" opacity="0.9" />
      </svg>
      <p key={step} className="coach-step coach-shimmer text-[13px] font-medium">
        {steps[step]}
      </p>
    </div>
  );
}
