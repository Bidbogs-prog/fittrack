"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { Magnetic } from "@/components/motion/magnetic";
import { Reveal } from "@/components/motion/reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-ink-800">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-full size-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-flame/[0.08] blur-[130px]"
      />
      <Reveal className="relative mx-auto w-full max-w-[1200px] px-6 py-28 text-center md:py-36">
        <h2
          className="mx-auto max-w-[16ch] font-display text-4xl font-bold leading-[0.98] tracking-tighter text-paper sm:text-5xl md:text-7xl"
          data-reveal
        >
          Stop guessing. <span className="bg-gradient-to-r from-flame-glow via-flame to-flame-deep bg-clip-text text-transparent">Start counting.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-[46ch] text-base leading-relaxed text-paper-dim" data-reveal>
          Your targets take about ninety seconds to set up. The first logged
          meal takes ten. Every سعرة after that is counted for you.
        </p>
        <div className="mt-10 flex justify-center" data-reveal>
          <Magnetic strength={0.3}>
            <Link
              href="/signup"
              className="group btn-press flex items-center gap-2 whitespace-nowrap rounded-full bg-flame py-3 pl-5 pr-2 font-display text-[13px] font-bold uppercase tracking-wide text-flame-ink shadow-[0_16px_48px_-12px_var(--flame)] transition-colors hover:bg-flame-deep sm:gap-3 sm:pl-7 sm:pr-3 sm:text-sm"
            >
              <span className="sm:hidden">Create free account</span>
              <span className="hidden sm:inline">Create your free account</span>
              <span className="grid size-9 place-items-center rounded-full bg-flame-ink/10 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105">
                <ArrowRight weight="bold" className="size-4" />
              </span>
            </Link>
          </Magnetic>
        </div>
      </Reveal>
    </section>
  );
}
