"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { DUR, EASE, NOT_REDUCED, gsap, useGSAP } from "./gsap";

/**
 * Remounts its subtree on route change (keyed by pathname) and plays a
 * soft page-enter: opacity + rise. Keeps in-app navigation feeling sewn
 * together without blocking interaction.
 */
export function RouteFx({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <PageEnter key={pathname}>{children}</PageEnter>;
}

function PageEnter({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(NOT_REDUCED, () => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: DUR.panel, ease: EASE.out, clearProps: "transform" },
        );
      });
    },
    { scope: ref },
  );

  return <div ref={ref}>{children}</div>;
}
