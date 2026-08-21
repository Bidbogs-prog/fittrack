const FACTS: [string, number][] = [
  ["Khobz (bread)", 265],
  ["Chicken tagine", 121],
  ["Couscous, cooked", 112],
  ["Harira", 58],
  ["Medjool dates", 277],
  ["Grilled sardines", 208],
  ["Msemen", 330],
  ["Greek yogurt", 97],
  ["Chicken breast", 165],
  ["Olive oil", 884],
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
          <span className="size-1 rounded-full bg-flame/70" />
        </span>
      ))}
    </div>
  );
}

/** Kinetic data band — per-100 g facts from kitchens the library knows. */
export function Marquee() {
  return (
    <section className="marquee relative overflow-hidden border-y border-ink-800 bg-ink-900/40 py-4">
      <div className="marquee-track">
        <Strip />
        <Strip hidden />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-ink-950 to-transparent sm:w-24"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ink-950 to-transparent sm:w-24"
      />
    </section>
  );
}
