import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CoachSection } from "@/components/landing/coach";
import { Faq } from "@/components/landing/faq";
import { WaitlistSection } from "@/components/landing/waitlist-section";
import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Marquee } from "@/components/landing/marquee";
import { LandingNav } from "@/components/landing/nav";
import { Pillars } from "@/components/landing/pillars";
import { SITE_DESCRIPTION, SITE_NAME, SITE_NAME_AR, SITE_URL } from "@/lib/site";

export default async function Home() {
  const t = await getTranslations("landing.footer");
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-clip bg-[radial-gradient(900px_500px_at_75%_10%,rgba(255,157,59,0.1),transparent_60%)]">
      <LandingNav />

      <main className="flex flex-1 flex-col">
        <Hero />
        <Marquee />
        <HowItWorks />
        <Pillars />
        <CoachSection />
        <WaitlistSection />
        <Faq />
        <FinalCta />
      </main>

      <footer className="border-t border-ink-850">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-4 px-6 pt-7 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-[13px] text-paper-mute">
          <span className="whitespace-nowrap">
            So3ra · <span lang="ar">{SITE_NAME_AR}</span> · {t("formerly")}
          </span>
          <nav aria-label={t("label")} className="flex flex-wrap gap-x-[18px] gap-y-1">
            <Link href="/login" className="hover:text-paper">
              {t("login")}
            </Link>
            <Link href="/signup" className="hover:text-paper">
              {t("signup")}
            </Link>
            <span>
              {t("foodData")}{" "}
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
            <Link href="/privacy" className="hover:text-paper">
              {t("privacy")}
            </Link>
            <Link href="/terms" className="hover:text-paper">
              {t("terms")}
            </Link>
            <Link href="/refunds" className="hover:text-paper">
              {t("refunds")}
            </Link>
            <span>English · Français · العربية</span>
          </nav>
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
