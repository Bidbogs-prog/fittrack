"use client";

import { useRef } from "react";
import { DUR, EASE, NOT_REDUCED, REDUCED, STAGGER, gsap, useGSAP } from "./gsap";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "ul" | "header" | "span";
  /** Vertical travel in px. */
  y?: number;
  /** Entrance blur in px (kept small — it resolves, not smears). */
  blur?: number;
  delay?: number;
  stagger?: number;
  duration?: number;
  /** When false, plays immediately on mount instead of on scroll. */
  onScroll?: boolean;
  /** ScrollTrigger start position. */
  start?: string;
};

/**
 * Scroll-choreographed entrance. Targets `[data-reveal]` descendants
 * (staggered in DOM order); if none exist, animates the wrapper itself.
 * Reduced-motion users get instant, fully-visible content.
 */
export function Reveal({
  children,
  className,
  as: Tag = "div",
  y = 22,
  blur = 5,
  delay = 0,
  stagger = STAGGER,
  duration = DUR.section,
  onScroll = true,
  start = "top 82%",
}: RevealProps) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const inner = root.querySelectorAll<HTMLElement>("[data-reveal]");
      const targets = inner.length > 0 ? Array.from(inner) : [root];

      // Root is pre-hidden by CSS ([data-reveal-self]); if we're animating
      // descendants instead, show the wrapper itself immediately.
      if (inner.length > 0) gsap.set(root, { opacity: 1 });

      const mm = gsap.matchMedia();
      mm.add(REDUCED, () => {
        gsap.set(targets, { opacity: 1, clearProps: "transform,filter" });
      });
      mm.add(NOT_REDUCED, () => {
        gsap.fromTo(
          targets,
          { opacity: 0, y, filter: `blur(${blur}px)` },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration,
            delay,
            stagger,
            ease: EASE.emphasis,
            clearProps: "filter,transform",
            scrollTrigger: onScroll
              ? { trigger: root, start, once: true }
              : undefined,
          },
        );
      });
    },
    { scope },
  );

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={scope as any} data-reveal-self className={className}>
      {children}
    </Tag>
  );
}
