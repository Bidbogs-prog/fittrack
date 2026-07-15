const FACTS: [string, number][] = [
  ["Chicken breast", 165],
  ["Basmati rice", 350],
  ["Rolled oats", 379],
  ["Whole eggs", 143],
  ["Greek yogurt", 97],
  ["Atlantic salmon", 208],
  ["Sweet potato", 86],
  ["Almonds", 579],
  ["Broccoli", 34],
  ["Lean beef 5%", 137],
];

function Strip({ hidden }: { hidden?: boolean }) {
  return (
    <div aria-hidden={hidden} className="flex shrink-0 items-center">
      {FACTS.map(([name, kcal]) => (
        <span
          key={name}
          className="flex items-center gap-6 pr-6 font-mono text-xs uppercase tracking-[0.18em] text-paper-mute"
        >
          <span className="whitespace-nowrap">
            {name} <span className="text-paper-dim">{kcal} kcal</span>
            <span className="text-paper-mute/60"> / 100 g</span>
          </span>
          <span className="size-1 rounded-full bg-lime/70" />
        </span>
      ))}
    </div>
  );
}

/** Kinetic data band — verified per-100 g facts scrolling forever. */
export function Marquee() {
  return (
    <section className="marquee relative overflow-hidden border-y border-ink-800 bg-ink-900/40 py-4">
      <div className="marquee-track">
        <Strip />
        <Strip hidden />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-ink-950 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-ink-950 to-transparent"
      />
    </section>
  );
}
