const FACTS: [string, number][] = [
  ["Msemen", 310],
  ["Harira", 72],
  ["Chicken tagine", 148],
  ["Basmati rice", 130],
  ["Greek yogurt", 59],
  ["Baghrir", 190],
  ["Dates", 282],
  ["Couscous", 112],
  ["Lentils", 116],
  ["Amlou", 590],
];

function Strip({ hidden }: { hidden?: boolean }) {
  return (
    <div aria-hidden={hidden} className="flex shrink-0 items-center">
      {FACTS.map(([name, kcal]) => (
        <span key={name} className="flex items-center gap-10 pe-10 font-display text-[15px] font-medium whitespace-nowrap text-paper-mute">
          <span>
            {name} <span className="font-mono text-ink-600">{kcal} kcal/100 g</span>
          </span>
          <span aria-hidden className="text-ink-700">✦</span>
        </span>
      ))}
    </div>
  );
}

/** Food marquee: per-100 g facts from kitchens the library knows. */
export function Marquee() {
  return (
    <section
      aria-label="Foods in the library"
      className="marquee overflow-hidden border-y border-ink-850 bg-ink-950 py-[18px]"
      dir="ltr"
    >
      <div className="marquee-track">
        <Strip />
        <Strip hidden />
      </div>
    </section>
  );
}
