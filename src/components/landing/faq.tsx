import { getTranslations } from "next-intl/server";
import { FaqItems } from "./faq-items";

const KEYS = ["targets", "moroccan", "safe", "offline", "name", "languages"] as const;

/** FAQ accordion (grid-rows 0fr → 1fr) plus FAQPage structured data. */
export async function Faq() {
  const t = await getTranslations("landing.faq");
  const items = KEYS.map((k) => ({ q: t(`${k}.q`), a: t(`${k}.a`) }));
  return (
    <section id="faq" className="mx-auto max-w-[820px] scroll-mt-20 px-6 pt-20 pb-10">
      <h2 className="mb-7 font-display text-[clamp(30px,4vw,44px)] leading-[1.05] font-bold tracking-[-0.04em] text-paper">
        {t("title")}
      </h2>
      <FaqItems items={items} />
      {/* AEO: the same Q/A as crawlable FAQPage structured data. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map(({ q, a }) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          }),
        }}
      />
    </section>
  );
}
