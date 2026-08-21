import { Eyebrow } from "@/components/landing/shell";
import { Reveal } from "@/components/motion/reveal";

const STEPS: [string, string, string][] = [
  [
    "Tell us your stats",
    "Sex, height, weight, and how often you train. Mifflin-St Jeor turns that into your BMR, TDEE and goal-shaped calorie and macro targets.",
    "≈ 90 seconds",
  ],
  [
    "Log the way you like",
    "Weigh it in grams, scan a barcode, re-log a saved meal, or just describe the plate in a sentence and let the AI portion it.",
    "≈ 10 seconds a meal",
  ],
  [
    "Let the numbers adapt",
    "Your logged weight trend recalibrates your real TDEE every week, and the Monday report tells you what to change.",
    "automatic",
  ],
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-28 border-y border-ink-800 bg-ink-900/30"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 py-24 sm:px-6 md:py-32">
        <Reveal className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-bold tracking-tighter text-paper md:text-5xl" data-reveal>
            Ninety seconds to your numbers.
          </h2>
        </Reveal>

        <Reveal className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8" stagger={0.12}>
          {STEPS.map(([title, copy, time], i) => (
            <div key={title} data-reveal className="relative border-t border-ink-700 pt-6">
              <span
                aria-hidden
                className="absolute -top-px left-0 h-px w-16 bg-lime"
              />
              <p className="font-mono text-sm text-lime tabular">0{i + 1}</p>
              <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-paper">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-paper-mute">{copy}</p>
              <p className="mt-4 inline-flex rounded-full border border-ink-700 bg-ink-950/60 px-3 py-1 font-mono text-[11px] text-paper-dim">
                {time}
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
