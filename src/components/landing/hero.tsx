"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, Lightning } from "@phosphor-icons/react";
import { CountUp } from "@/components/motion/count-up";
import { EASE, NOT_REDUCED, REDUCED, gsap, useGSAP } from "@/components/motion/gsap";
import { Magnetic } from "@/components/motion/magnetic";
import { DrawnBar, DrawnRing } from "@/components/motion/progress";
import { TiltCard } from "@/components/motion/tilt-card";

const MOCK_MACROS = [
  ["Protein", "162 / 176 g", 92, "bg-protein"],
  ["Carbs", "203 / 264 g", 77, "bg-carbs"],
  ["Fat", "48 / 69 g", 70, "bg-fat"],
  ["Fibre", "24 / 35 g", 69, "bg-fibre"],
] as const;

export function Hero() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const all = [
        ...q("[data-reveal]"),
        ...q(".h-line"),
      ] as HTMLElement[];

      const mm = gsap.matchMedia();
      mm.add(REDUCED, () => {
        gsap.set(all, { opacity: 1, clearProps: "transform" });
      });
      mm.add(NOT_REDUCED, () => {
        const tl = gsap.timeline({ defaults: { ease: EASE.emphasis } });
        tl.fromTo(
          q(".h-badge"),
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.7 },
          0.1,
        )
          .fromTo(
            q(".h-line"),
            { yPercent: 118 },
            { yPercent: 0, duration: 1.05, stagger: 0.12 },
            0.2,
          )
          .fromTo(
            q(".h-copy"),
            { opacity: 0, y: 22 },
            { opacity: 1, y: 0, duration: 0.8 },
            0.62,
          )
          .fromTo(
            q(".h-cta"),
            { opacity: 0, y: 22 },
            { opacity: 1, y: 0, duration: 0.8 },
            0.74,
          )
          .fromTo(
            q(".h-stats"),
            { opacity: 0, y: 22 },
            { opacity: 1, y: 0, duration: 0.8 },
            0.86,
          )
          .fromTo(
            q(".h-scene"),
            {
              opacity: 0,
              y: 48,
              scale: 0.94,
              rotationY: -16,
              rotationX: 9,
              transformPerspective: 1100,
            },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              rotationY: 0,
              rotationX: 0,
              duration: 1.5,
            },
            0.4,
          )
          .fromTo(
            q(".h-chip"),
            { opacity: 0, scale: 0.5 },
            { opacity: 1, scale: 1, duration: 0.7, ease: EASE.settle, stagger: 0.1 },
            1.15,
          );

        // Gentle parallax as the hero scrolls away.
        gsap.to(q(".h-scene"), {
          y: -36,
          ease: "none",
          scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 0.6 },
        });
      });
    },
    { scope },
  );

  return (
    <div
      ref={scope}
      className="relative mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-14 px-6 pb-20 pt-36 md:pt-44 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10"
    >
      {/* left: message — capped at md so it doesn't orphan-left in the
          single-column tablet range */}
      <div className="md:max-w-2xl lg:max-w-none">
        <p className="h-badge mb-6 inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/70 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-dim" data-reveal>
          <Lightning weight="fill" className="size-3 text-lime" />
          Nutrition, engineered
        </p>
        <h1 className="font-display text-[2.6rem] font-bold leading-[0.96] tracking-tighter text-paper sm:text-[3.4rem] md:text-6xl lg:text-[4.25rem] xl:text-[5.4rem]">
          <span className="block overflow-hidden pb-1">
            <span className="h-line block translate-y-[118%] motion-reduce:translate-y-0">
              Train hard.
            </span>
          </span>
          <span className="block overflow-hidden pb-2">
            <span className="h-line block translate-y-[118%] motion-reduce:translate-y-0">
              Eat <span className="text-lime">exact</span>.
            </span>
          </span>
        </h1>
        <p className="h-copy mt-6 max-w-[50ch] text-base leading-relaxed text-paper-dim md:text-lg" data-reveal>
          FitTrack turns your body stats and training frequency into daily calorie
          and macro targets — then tracks every meal to the gram against them.
        </p>
        <div className="h-cta mt-9 flex flex-wrap items-center gap-5" data-reveal>
          <Magnetic strength={0.3}>
            <Link
              href="/signup"
              className="group btn-press flex items-center gap-3 rounded-full bg-lime py-2.5 pl-6 pr-2.5 font-display text-sm font-bold uppercase tracking-wide text-lime-ink shadow-[0_12px_40px_-12px_var(--lime)] transition-colors hover:bg-lime-deep"
            >
              Start tracking free
              <span className="grid size-9 place-items-center rounded-full bg-lime-ink/10 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105">
                <ArrowRight weight="bold" className="size-4" />
              </span>
            </Link>
          </Magnetic>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center text-sm font-medium text-paper-dim underline-offset-4 transition-colors hover:text-paper hover:underline"
          >
            I already have an account
          </Link>
        </div>

        <dl className="h-stats mt-14 grid max-w-md grid-cols-3 divide-x divide-ink-700 border-y border-ink-700" data-reveal>
          {(
            [
              [100, " g", "unit precision"],
              [5, "", "macro dimensions"],
              [3, "", "goal programs"],
            ] as const
          ).map(([n, suffix, label]) => (
            <div key={label} className="px-3 py-4 first:pl-0 sm:px-4">
              <dt className="font-mono text-2xl font-semibold tracking-tight text-paper tabular">
                <CountUp value={n} delay={1} />
                {suffix}
              </dt>
              <dd className="mt-1 text-xs text-paper-mute">{label}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* right: 3D product scene */}
      <div className="h-scene relative mx-auto w-full max-w-md lg:max-w-none" data-reveal>
        {/* orbit rings */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center"
          style={{ perspective: "900px" }}
        >
          {/* Sized relative to the scene so they scale with the column
              instead of overflowing it at intermediate widths. */}
          <div className="orbit-ring absolute aspect-square w-[124%] rounded-full border border-lime/[0.14]" />
          <div className="orbit-ring-slow absolute aspect-square w-[96%] rounded-full border border-white/[0.07]" />
        </div>

        <TiltCard maxTilt={8} className="lg:pl-8">
          {/* double-bezel shell */}
          <div
            className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-2 shadow-[0_48px_96px_-40px_rgba(0,0,0,0.85)]"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div
              className="glare relative rounded-[calc(1.9rem-0.5rem)] border border-white/[0.06] bg-ink-900 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-paper-mute">
                  Today · lean bulk
                </p>
                <p className="font-mono text-xs text-paper-mute tabular">TDEE 2,840</p>
              </div>

              <div className="mt-5 flex flex-col items-center gap-5 min-[400px]:flex-row min-[400px]:gap-6" data-depth="26">
                <div className="relative size-32 shrink-0">
                  <DrawnRing pct={0.79} radius={56} stroke={9} color="var(--lime)" delay={0.9} className="size-full" />
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="font-mono text-xl font-semibold tracking-tight text-paper tabular">
                        <CountUp value={1962} delay={0.9} />
                      </p>
                      <p className="text-[11px] text-paper-mute">of 2,490 kcal</p>
                    </div>
                  </div>
                </div>
                <div className="w-full min-w-0 flex-1 space-y-3.5">
                  {MOCK_MACROS.map(([name, value, pct, color], i) => (
                    <div key={name}>
                      <div className="flex justify-between text-[11px]">
                        <span className="font-medium text-paper-dim">{name}</span>
                        <span className="font-mono text-paper-mute tabular">{value}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
                        <DrawnBar pct={pct} delay={1 + i * 0.12} className={color} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3" data-depth="18">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-paper">Chicken breast</p>
                    <p className="text-[11px] text-paper-mute">dinner · 220 g</p>
                  </div>
                  <p className="font-mono text-sm text-paper-dim tabular">264 kcal</p>
                </div>
              </div>
            </div>
          </div>

          {/* floating chips on their own Z planes */}
          <div className="h-chip absolute -right-4 -top-6 xl:-right-10" data-depth="70" data-reveal>
            <span className="floaty flex items-center gap-2 rounded-full border border-white/10 bg-ink-850/95 px-3.5 py-2 text-xs font-medium text-paper shadow-[0_20px_40px_-16px_rgba(0,0,0,0.8)]">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-lime" />
              </span>
              Streak · 18 days
            </span>
          </div>
          <div className="h-chip absolute -left-4 top-1/3 md:-left-12" data-depth="55" data-reveal>
            <span className="floaty block rounded-full border border-white/10 bg-ink-850/95 px-3.5 py-2 font-mono text-xs text-paper shadow-[0_20px_40px_-16px_rgba(0,0,0,0.8)] tabular [animation-delay:-2.4s]">
              +42 g protein
            </span>
          </div>
          <div className="h-chip absolute -bottom-5 right-8" data-depth="45" data-reveal>
            <span className="floaty block rounded-full border border-lime/25 bg-lime/10 px-3.5 py-2 font-mono text-xs text-lime shadow-[0_20px_40px_-16px_rgba(0,0,0,0.8)] tabular [animation-delay:-4.1s]">
              528 kcal left
            </span>
          </div>
        </TiltCard>
      </div>
    </div>
  );
}
