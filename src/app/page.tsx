import Link from "next/link";
import { ArrowRight, Barbell, ChartLineUp, ForkKnife } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/logo";

const PILLARS = [
  {
    icon: ChartLineUp,
    title: "Targets built on science",
    body: "Mifflin-St Jeor BMR and a training-frequency multiplier give you a TDEE you can trust — then your goal shapes calories and macros.",
  },
  {
    icon: ForkKnife,
    title: "Per-gram precision",
    body: "Every food is stored per 100 g. Log 137 g of rice and get exactly 137 g worth of protein, carbs, fat and fibre. No guessing.",
  },
  {
    icon: Barbell,
    title: "Coach-built meal plans",
    body: "Cut, maintain or build — browse day plans assembled from the same verified food library your diary uses.",
  },
];

export default function Home() {
  return (
    <div className="blueprint relative flex min-h-[100dvh] flex-col overflow-hidden">
      {/* atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-15%] size-[640px] rounded-full bg-lime/[0.07] blur-[120px]"
      />
      <header className="relative z-10 mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="btn-press rounded-lg px-4 py-2 text-sm font-medium text-paper-dim hover:text-paper"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="btn-press rounded-lg bg-paper px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-white"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-16 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        {/* left: message */}
        <div>
          <p className="reveal mb-5 inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-paper-dim" style={{ "--i": 0 } as React.CSSProperties}>
            <span className="size-1.5 animate-pulse rounded-full bg-lime" />
            Nutrition, engineered
          </p>
          <h1
            className="reveal font-display text-5xl font-bold leading-[0.98] tracking-tighter text-paper md:text-7xl"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            Train hard.
            <br />
            Eat <span className="text-lime">exact</span>.
          </h1>
          <p
            className="reveal mt-6 max-w-[52ch] text-base leading-relaxed text-paper-dim md:text-lg"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            FitTrack turns your body stats and training frequency into daily calorie and
            macro targets — then tracks every meal to the gram against them.
          </p>
          <div className="reveal mt-9 flex flex-wrap items-center gap-4" style={{ "--i": 3 } as React.CSSProperties}>
            <Link
              href="/signup"
              className="btn-press inline-flex items-center gap-2 rounded-xl bg-lime px-6 py-3.5 font-display text-sm font-bold uppercase tracking-wide text-lime-ink shadow-[0_8px_32px_-8px_var(--lime)] hover:bg-lime-deep"
            >
              Start tracking free
              <ArrowRight weight="bold" className="size-4" />
            </Link>
            <Link href="/login" className="text-sm font-medium text-paper-dim underline-offset-4 hover:text-paper hover:underline">
              I already have an account
            </Link>
          </div>

          <dl className="reveal mt-14 grid max-w-md grid-cols-3 divide-x divide-ink-700 border-y border-ink-700" style={{ "--i": 4 } as React.CSSProperties}>
            {[
              ["100 g", "unit precision"],
              ["5", "macro dimensions"],
              ["3", "goal programs"],
            ].map(([n, label]) => (
              <div key={label} className="px-4 py-4 first:pl-0">
                <dt className="font-mono text-2xl font-semibold tracking-tight text-paper tabular">{n}</dt>
                <dd className="mt-1 text-xs text-paper-mute">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* right: product vignette */}
        <div className="reveal relative hidden lg:block" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="rounded-2xl border border-ink-700 bg-ink-900/80 p-6 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-paper-mute">Today</p>
              <p className="font-mono text-xs text-paper-mute">TDEE 2,840 kcal</p>
            </div>
            <p className="mt-4 font-mono text-5xl font-semibold tracking-tight text-paper tabular">
              1,962<span className="text-xl text-paper-mute"> / 2,490</span>
            </p>
            <p className="mt-1 text-xs text-paper-mute">calories eaten · lean bulk</p>
            <div className="mt-6 space-y-4">
              {[
                ["Protein", "162 / 176 g", "92%", "bg-protein"],
                ["Carbs", "203 / 264 g", "77%", "bg-carbs"],
                ["Fat", "48 / 69 g", "70%", "bg-fat"],
                ["Fibre", "24 / 35 g", "69%", "bg-fibre"],
              ].map(([name, value, pct, color]) => (
                <div key={name}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-paper-dim">{name}</span>
                    <span className="font-mono text-paper-mute tabular">{value}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <div className={`h-full rounded-full ${color}`} style={{ width: pct }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-paper">Chicken breast</p>
                  <p className="text-xs text-paper-mute">dinner · 220 g</p>
                </div>
                <p className="font-mono text-sm text-paper-dim tabular">264 kcal</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section className="relative z-10 border-t border-ink-800 bg-ink-950/60">
        <div className="mx-auto grid w-full max-w-[1200px] gap-px overflow-hidden px-6 py-14 md:grid-cols-3 md:gap-10">
          {PILLARS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="reveal py-6 md:py-0" style={{ "--i": i + 5 } as React.CSSProperties}>
              <Icon weight="duotone" className="size-7 text-lime" />
              <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-paper">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-mute">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-ink-800">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-6 text-xs text-paper-mute">
          <span>FitTrack — eat exact, train hard.</span>
          <span className="font-mono">v0.1</span>
        </div>
      </footer>
    </div>
  );
}
