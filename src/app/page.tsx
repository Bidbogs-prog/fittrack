import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { Marquee } from "@/components/landing/marquee";
import { LandingNav } from "@/components/landing/nav";
import { Pillars } from "@/components/landing/pillars";

export default function Home() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-clip">
      {/* atmosphere: blueprint grid fading out + lime orbs */}
      <div
        aria-hidden
        className="blueprint pointer-events-none absolute inset-x-0 top-0 h-[110dvh] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-15%] size-[640px] rounded-full bg-lime/[0.07] blur-[120px]"
      />

      <LandingNav />

      <main className="relative flex flex-1 flex-col">
        <Hero />
        <Marquee />
        <Pillars />
        <FinalCta />
      </main>

      <footer className="relative border-t border-ink-800">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-6 text-xs text-paper-mute">
          <span>FitTrack — eat exact, train hard.</span>
          <span className="font-mono">v0.2</span>
        </div>
      </footer>
    </div>
  );
}
