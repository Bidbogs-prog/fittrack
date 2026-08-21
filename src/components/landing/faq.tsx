import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Eyebrow } from "@/components/landing/shell";
import { Reveal } from "@/components/motion/reveal";

const FAQS: [string, string][] = [
  [
    "What does “So3ra” mean?",
    "So3ra is سعرة — “calorie” in Arabic. The 3 is Arabizi shorthand for the letter ع, the way it’s typed every day across Morocco.",
  ],
  [
    "Is So3ra free?",
    "Yes. Create an account and start logging — no credit card, no trial clock.",
  ],
  [
    "How are my calorie and macro targets calculated?",
    "Your BMR comes from the Mifflin-St Jeor equation, scaled by how often you train to get your TDEE. Your goal (cut, maintain, build) then shapes calories and macros — and once you log weight regularly, the adaptive engine recalibrates against your real trend.",
  ],
  [
    "Does it know Moroccan food?",
    "The food library includes Moroccan products from Open Food Facts alongside a verified staple library — harira, msemen, khobz and the rest — and you can add your own foods and recipes, all stored per 100 g.",
  ],
  [
    "Can I log a meal by just describing it?",
    "Yes. Write “harira and two msemen” (or snap a photo) and the AI splits it into foods with estimated gram portions. You review and confirm before anything is saved.",
  ],
  [
    "Does it work on my phone, offline?",
    "So3ra is mobile-first and installs as an app. Pages you’ve visited keep working offline, and meals you log without a connection sync when you’re back.",
  ],
  [
    "Is it available in Arabic?",
    "English, French and Arabic — with proper right-to-left layout, not a mirrored afterthought.",
  ],
  [
    "Is the AI coaching medical advice?",
    "No. Insights and reports are general nutrition guidance computed from your own logs. For medical conditions, talk to a doctor or registered dietitian.",
  ],
];

export function Faq() {
  return (
    <section id="faq" className="relative mx-auto w-full max-w-[1200px] scroll-mt-28 px-4 py-24 sm:px-6 md:py-32">
      <Reveal className="max-w-2xl">
        <Eyebrow>FAQ</Eyebrow>
        <h2 className="mt-5 font-display text-4xl font-bold tracking-tighter text-paper md:text-5xl" data-reveal>
          Fair questions.
        </h2>
      </Reveal>

      <Reveal className="mt-12 max-w-3xl divide-y divide-ink-800 border-y border-ink-800">
        {FAQS.map(([q, a]) => (
          <details key={q} className="group" data-reveal>
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left [&::-webkit-details-marker]:hidden">
              <span className="font-display text-base font-semibold tracking-tight text-paper sm:text-lg">
                {q}
              </span>
              <Plus
                weight="bold"
                className="size-4 shrink-0 text-paper-mute transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-open:rotate-45 group-open:text-lime"
              />
            </summary>
            <p className="pb-5 pr-8 text-sm leading-relaxed text-paper-dim">{a}</p>
          </details>
        ))}
      </Reveal>

      {/* AEO: the same Q/A as crawlable FAQPage structured data. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map(([q, a]) => ({
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
