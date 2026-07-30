"use client";

import { useRef } from "react";
import { NOT_REDUCED, gsap, useGSAP } from "./gsap";

/**
 * Magnetic hover physics: the child drifts toward the cursor while hovered
 * and springs back on leave. Wrap exactly one interactive element.
 */
export function Magnetic({
  children,
  className,
  strength = 0.32,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      // Fine pointers only — on touch, a drag starting here would slide the
      // button under the finger mid-scroll.
      mm.add(`${NOT_REDUCED} and (pointer: fine)`, () => {
        const x = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
        const y = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });

        const onMove = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          x((e.clientX - (r.left + r.width / 2)) * strength);
          y((e.clientY - (r.top + r.height / 2)) * strength);
        };
        const onLeave = () => {
          gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1,0.45)" });
        };

        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
        return () => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerleave", onLeave);
        };
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className ?? "inline-block"}>
      {children}
    </div>
  );
}
