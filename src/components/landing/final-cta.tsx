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
        className="pointer-events-none absolute left-1/2 top-full size-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-lime/[0.08] blur-[130px]"
      />
      <Reveal className="relative mx-auto w-full max-w-[1200px] px-6 py-28 text-center md:py-36">
        <h2
          className="mx-auto max-w-[16ch] font-display text-5xl font-bold leading-[0.98] tracking-tighter text-paper md:text-7xl"
          data-reveal
        >
          Stop guessing. <span className="text-lime">Start weighing.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-[46ch] text-base leading-relaxed text-paper-dim" data-reveal>
          Your targets take about ninety seconds to set up. The first logged
          meal takes ten.
        </p>
        <div className="mt-10 flex justify-center" data-reveal>
          <Magnetic strength={0.3}>
            <Link
              href="/signup"
              className="group btn-press flex items-center gap-3 rounded-full bg-lime py-3 pl-7 pr-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink shadow-[0_16px_48px_-12px_var(--lime)] transition-colors hover:bg-lime-deep"
            >
              Create your free account
              <span className="grid size-9 place-items-center rounded-full bg-lime-ink/10 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105">
                <ArrowRight weight="bold" className="size-4" />
              </span>
            </Link>
          </Magnetic>
        </div>
      </Reveal>
    </section>
  );
}
