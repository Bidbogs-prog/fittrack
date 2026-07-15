"use client";

import { useRef } from "react";
import { NOT_REDUCED, gsap, useGSAP } from "./gsap";

/**
 * 3D perspective card that tilts toward the cursor. Descendants with
 * `data-depth="<px>"` float on their own Z plane (parallax inside the card).
 * A `--mx / --my` CSS-var spotlight follows the pointer for glare effects.
 */
export function TiltCard({
  children,
  className,
  maxTilt = 9,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const wrap = frame.current;
      const el = card.current;
      if (!wrap || !el) return;

      const mm = gsap.matchMedia();
      mm.add(NOT_REDUCED, () => {
        // Depth layers are static translateZ — the parent rotation sells the parallax.
        el.querySelectorAll<HTMLElement>("[data-depth]").forEach((layer) => {
          gsap.set(layer, { z: parseFloat(layer.dataset.depth ?? "0") });
        });

        const rx = gsap.quickTo(el, "rotationX", { duration: 0.7, ease: "power3.out" });
        const ry = gsap.quickTo(el, "rotationY", { duration: 0.7, ease: "power3.out" });
        const mx = gsap.quickSetter(el, "--mx", "%") as (v: number) => void;
        const my = gsap.quickSetter(el, "--my", "%") as (v: number) => void;

        const onMove = (e: PointerEvent) => {
          const r = wrap.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width; // 0..1
          const py = (e.clientY - r.top) / r.height;
          ry((px - 0.5) * 2 * maxTilt);
          rx((0.5 - py) * 2 * maxTilt);
          mx(px * 100);
          my(py * 100);
        };
        const onLeave = () => {
          rx(0);
          ry(0);
        };

        wrap.addEventListener("pointermove", onMove);
        wrap.addEventListener("pointerleave", onLeave);
        return () => {
          wrap.removeEventListener("pointermove", onMove);
          wrap.removeEventListener("pointerleave", onLeave);
        };
      });
    },
    { scope: frame },
  );

  return (
    <div ref={frame} style={{ perspective: "1200px" }} className={className}>
      <div
        ref={card}
        style={{ transformStyle: "preserve-3d", "--mx": "50%", "--my": "50%" } as React.CSSProperties}
        className="relative [will-change:transform]"
      >
        {children}
      </div>
    </div>
  );
}
