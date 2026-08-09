"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Logo } from "@/components/logo";
import { EASE, NOT_REDUCED, REDUCED, gsap, useGSAP } from "@/components/motion/gsap";
import { Magnetic } from "@/components/motion/magnetic";

/** Floating glass island nav, detached from the top edge. */
export function LandingNav() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(REDUCED, () => gsap.set(el, { opacity: 1 }));
      mm.add(NOT_REDUCED, () => {
        gsap.fromTo(
          el,
          { opacity: 0, y: -28 },
          { opacity: 1, y: 0, duration: 0.9, delay: 0.15, ease: EASE.emphasis },
        );
      });
    },
    { scope: ref },
  );

  return (
    // fixed elements ignore the body's safe-area padding — offset directly
    <div className="pointer-events-none fixed inset-x-0 top-[calc(1rem+env(safe-area-inset-top))] z-50 flex justify-center px-4">
      <div
        ref={ref}
        data-reveal-self
        className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-2 rounded-full border border-white/10 bg-ink-950/70 py-2 pl-4 pr-2 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:gap-3"
      >
        <Logo />
        <nav className="flex items-center gap-1">
          <Link
            href="/login"
            className="btn-press rounded-full px-3 py-2.5 text-sm font-medium text-paper-dim transition-colors hover:text-paper pointer-coarse:py-3 sm:px-4"
          >
            Log in
          </Link>
          <Magnetic strength={0.25}>
            <Link
              href="/signup"
              className="group btn-press flex items-center gap-2 whitespace-nowrap rounded-full bg-lime py-1.5 pl-3.5 pr-1.5 text-[13px] font-semibold text-lime-ink transition-colors hover:bg-lime-deep pointer-coarse:py-2 sm:gap-2.5 sm:pl-4 sm:text-sm"
            >
              Get started
              <span className="grid size-7 place-items-center rounded-full bg-lime-ink/10 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:scale-105">
                <ArrowRight weight="bold" className="size-3.5" />
              </span>
            </Link>
          </Magnetic>
        </nav>
      </div>
    </div>
  );
}
