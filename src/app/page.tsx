import Link from "next/link";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Marquee } from "@/components/landing/marquee";
import { LandingNav } from "@/components/landing/nav";
import { Pillars } from "@/components/landing/pillars";
import { LogoMark } from "@/components/logo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_NAME_AR, SITE_URL } from "@/lib/site";

const FOOTER_LINKS: { title: string; links: [string, string][] }[] = [
  {
    title: "Product",
    links: [
      ["Features", "#features"],
      ["How it works", "#how-it-works"],
      ["FAQ", "#faq"],
    ],
  },
  {
    title: "Account",
    links: [
      ["Create account", "/signup"],
      ["Log in", "/login"],
    ],
  },
];

export default function Home() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-clip">
      {/* atmosphere: blueprint grid fading out + flame orbs */}
      <div
        aria-hidden
        className="blueprint pointer-events-none absolute inset-x-0 top-0 h-[110dvh] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-15%] size-[640px] rounded-full bg-flame/[0.07] blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-12%] top-[46dvh] size-[520px] rounded-full bg-flame-deep/[0.05] blur-[130px]"
      />

      <LandingNav />

      <main className="relative flex flex-1 flex-col">
        <Hero />
        <Marquee />
        <Pillars />
        <Features />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>

      <footer className="relative border-t border-ink-800">
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-12 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <span className="inline-flex items-center gap-2.5">
                <LogoMark />
                <span className="font-display text-lg font-bold tracking-tight text-paper">
                  So<span className="text-flame">3</span>ra
                </span>
              </span>
              <p className="mt-3 text-sm leading-relaxed text-paper-mute">
                <span dir="rtl" lang="ar">{SITE_NAME_AR}</span> — “calorie” in
                Arabic. Every one of yours, counted.
              </p>
              <p className="mt-3 text-xs text-paper-mute">
                English · Français · العربية
              </p>
            </div>
            <div className="flex gap-16">
              {FOOTER_LINKS.map(({ title, links }) => (
                <nav key={title} aria-label={title}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-paper-mute">
                    {title}
                  </p>
                  <ul className="mt-3 space-y-1">
                    {links.map(([label, href]) => (
                      <li key={href}>
                        <Link
                          href={href}
                          className="inline-flex min-h-9 items-center text-sm text-paper-dim transition-colors hover:text-paper"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-ink-800 pt-5 text-xs text-paper-mute">
            <span>
              © {new Date().getFullYear()} {SITE_NAME} · Food data:{" "}
              <a
                href="https://world.openfoodfacts.org"
                rel="noreferrer"
                target="_blank"
                className="underline underline-offset-2 hover:text-paper"
              >
                Open Food Facts
              </a>{" "}
              (ODbL)
            </span>
            <span className="font-mono">v0.3</span>
          </div>
        </div>
      </footer>

      {/* SEO: app-level structured data for search + AI answer engines. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: SITE_NAME,
            alternateName: SITE_NAME_AR,
            url: SITE_URL,
            description: SITE_DESCRIPTION,
            applicationCategory: "HealthApplication",
            operatingSystem: "Web",
            inLanguage: ["en", "fr", "ar"],
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          }),
        }}
      />
    </div>
  );
}
