import { ArrowRight, Barbell, ChartLineUp, ForkKnife, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { CountUp } from "@/components/motion/count-up";
import { DrawnBar } from "@/components/motion/progress";
import { Reveal } from "@/components/motion/reveal";

function Shell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-reveal
      className={`card-lift rounded-[1.9rem] border border-white/[0.08] bg-white/[0.03] p-2 ${className}`}
    >
      <div className="h-full rounded-[calc(1.9rem-0.5rem)] border border-white/[0.05] bg-ink-900/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-7 md:p-8">
        {children}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center rounded-full border border-ink-700 bg-ink-950/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-paper-mute">
      {children}
    </p>
  );
}

/** Asymmetric bento — the three product pillars, each with a live visual. */
export function Pillars() {
  return (
    <section className="relative mx-auto w-full max-w-[1200px] px-4 py-24 sm:px-6 md:py-32">
      <Reveal className="max-w-2xl">
        <Eyebrow>The system</Eyebrow>
        <h2 className="mt-5 font-display text-4xl font-bold tracking-tighter text-paper md:text-5xl" data-reveal>
          Numbers you can train on.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-paper-dim" data-reveal>
          No estimates, no vibes. One equation, one verified food library, and
          plans built from the same math your diary runs on.
        </p>
      </Reveal>

      <Reveal className="mt-14 grid gap-5 lg:grid-cols-12" stagger={0.12}>
        {/* pillar 1 — the equation */}
        <Shell className="lg:col-span-7">
          <ChartLineUp weight="duotone" className="size-7 text-lime" />
          <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-paper">
            Targets built on science
          </h3>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-paper-mute">
            Mifflin-St Jeor BMR, scaled by how often you actually train. Your
            goal then shapes calories and macros — recomputed the moment your
            body changes.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4">
            {(
              [
                ["BMR", 1742, "resting burn"],
                ["TDEE", 2700, "× 1.55 training"],
                ["Target", 2490, "lean bulk"],
              ] as const
            ).map(([label, value, sub], i) => (
              <div key={label} className="flex items-center gap-5">
                {i > 0 && <ArrowRight weight="bold" className="size-4 text-paper-mute/60" />}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-paper-mute">
                    {label}
                  </p>
                  <p className={`font-mono text-3xl font-semibold tracking-tight tabular ${label === "Target" ? "text-lime" : "text-paper"}`}>
                    <CountUp value={value} />
                  </p>
                  <p className="text-[11px] text-paper-mute">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </Shell>

        {/* pillar 2 — per-gram precision */}
        <Shell className="lg:col-span-5">
          <ForkKnife weight="duotone" className="size-7 text-lime" />
          <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-paper">
            Per-gram precision
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-paper-mute">
            Every food is stored per 100 g. Log 137 g of rice and the math is
            exact — never rounded to a “serving”.
          </p>
          <div className="mt-7 rounded-xl border border-ink-700 bg-ink-950/50 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium text-paper">Basmati rice</p>
              <p className="font-mono text-lg font-semibold text-lime tabular">
                <CountUp value={137} /> g
              </p>
            </div>
            <div className="mt-3 space-y-2.5">
              {(
                [
                  ["P", 12.3, 34, "bg-protein"],
                  ["C", 105.5, 86, "bg-carbs"],
                  ["F", 1.4, 9, "bg-fat"],
                ] as const
              ).map(([label, grams, pct, color], i) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-3 font-mono text-[11px] text-paper-mute">{label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                    <DrawnBar pct={pct} delay={i * 0.12} className={color} />
                  </div>
                  <span className="w-14 text-right font-mono text-[11px] text-paper-dim tabular">
                    {grams} g
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Shell>

        {/* pillar 3 — coach-built plans */}
        <Shell className="lg:col-span-12">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <Barbell weight="duotone" className="size-7 text-lime" />
              <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-paper">
                Coach-built meal plans
              </h3>
              <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-paper-mute">
                Cut, maintain or build — browse full days of eating assembled
                from the same verified library your diary uses, totalled to the
                calorie.
              </p>
              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/[0.07] px-3.5 py-1.5 text-xs font-medium text-lime">
                <SealCheck weight="fill" className="size-4" />
                Every plan verified against the library
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["High-protein cut", 1980, 186],
                  ["Steady maintain", 2510, 168],
                  ["Lean bulk day", 2960, 197],
                ] as const
              ).map(([name, kcal, protein]) => (
                <div
                  key={name}
                  className="rounded-xl border border-ink-700 bg-ink-950/50 p-4"
                >
                  <p className="text-sm font-medium text-paper">{name}</p>
                  <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-paper tabular">
                    <CountUp value={kcal} />
                  </p>
                  <p className="text-[11px] text-paper-mute">kcal · {protein} g protein</p>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      </Reveal>
    </section>
  );
}
