import { Microphone } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Orbit } from "@/components/orbit/orbit";

/** Hero: headline + CTAs + stats beside a slowly turning orbit with floating chips. */
export async function Hero() {
  const t = await getTranslations("landing.hero");
  return (
    <section className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-center gap-12 px-6 pt-16 pb-10 lg:pt-[72px]">
      <div className="flex flex-col gap-6">
        <p className="inline-flex items-center gap-2 self-start rounded-full border border-flame/30 bg-flame/[0.07] px-3.5 py-1.5 text-xs whitespace-nowrap text-flame">
          <span className="size-1.5 rounded-full bg-flame" />
          {t("badge")}
        </p>
        <h1 className="font-display text-[clamp(48px,7vw,88px)] leading-[0.95] font-bold tracking-[-0.05em] text-balance text-paper">
          {t.rich("title", { grad: (c) => <span className="text-grad">{c}</span> })}
        </h1>
        <p className="max-w-[46ch] text-lg leading-relaxed text-pretty text-paper-dim">{t("lede")}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className="btn-flame btn-press glow-flame inline-flex min-h-[52px] items-center rounded-[14px] px-6 text-base">
            {t("cta")} <span aria-hidden className="ms-1.5 rtl:-scale-x-100">→</span>
          </Link>
          <a
            href="#how"
            className="btn-press inline-flex min-h-[52px] items-center rounded-[14px] border border-ink-700 px-6 text-base text-paper hover:border-ink-600"
          >
            {t("demo")}
          </a>
        </div>
        <dl className="flex flex-wrap gap-7 border-t border-ink-850 pt-2">
          {(
            [
              ["8,400", t("statFoods")],
              ["1 g", t("statPrecision")],
              ["3", t("statLanguages")],
            ] as const
          ).map(([value, label]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-xs text-paper-mute">{label}</dt>
              <dd className="font-mono text-[22px] font-semibold text-paper">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="relative aspect-square w-full max-w-[480px] justify-self-center">
        <div aria-hidden className="absolute -inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(255,157,59,0.14),transparent_62%)]" />
        <Orbit
          rings={[0.72, 0.68, 0.83]}
          window={{ startMin: 10 * 60, endMin: 18 * 60 }}
          dots={[
            { key: "b", minutes: 8 * 60 + 30 },
            { key: "l", minutes: 13 * 60 },
          ]}
          now={17 * 60 + 40}
          spinTicks
          labels={false}
          summary={t("orbitSummary")}
          className="size-full"
        >
          <div className="absolute inset-[32.5%] flex flex-col items-center justify-center rounded-full bg-ink-900 shadow-[inset_0_0_0_1px_var(--ink-700)]">
            <span className="font-mono text-[clamp(28px,4vw,40px)] leading-none font-semibold tracking-[-0.04em] text-paper">742</span>
            <span className="mt-1 text-[11px] tracking-[0.1em] text-paper-mute uppercase">{t("kcalLeft")}</span>
          </div>
        </Orbit>

        <div aria-hidden className="absolute end-0 top-[8%]">
          <div className="floaty rounded-2xl border border-ink-700 bg-ink-850 px-3.5 py-2.5 shadow-[0_20px_40px_-16px_rgba(0,0,0,0.8)]">
            <p className="font-mono text-[11px] font-medium text-paper-mute">08:30 · {t("breakfast")}</p>
            <p className="text-sm text-paper">
              {t("breakfastItems")} <span className="font-mono text-paper-dim">612</span>
            </p>
          </div>
        </div>
        <div aria-hidden className="absolute -start-[4%] bottom-[12%] max-w-[240px]">
          <div
            className="floaty rounded-2xl border border-flame/35 bg-[linear-gradient(135deg,rgba(40,24,10,0.95),rgba(23,18,14,0.95))] px-3.5 py-2.5 shadow-[0_20px_40px_-16px_rgba(0,0,0,0.8)]"
            style={{ animationDuration: "7s", animationDelay: "-2s" }}
          >
            <p className="font-mono text-[11px] font-medium text-flame">COACH</p>
            <p className="text-sm leading-snug text-paper">
              {t.rich("coachChip", { b: (c) => <b className="font-semibold text-flame-glow">{c}</b> })}
            </p>
          </div>
        </div>
        <div aria-hidden className="absolute end-[6%] bottom-[2%]">
          <div
            className="floaty flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850 py-2 ps-2.5 pe-3.5 text-[13px] shadow-[0_20px_40px_-16px_rgba(0,0,0,0.8)]"
            style={{ animationDuration: "5.5s", animationDelay: "-1s" }}
          >
            <span className="grid size-[26px] place-items-center rounded-full bg-[linear-gradient(135deg,#ffc94d,#f2701f)] text-flame-ink">
              <Microphone weight="fill" className="size-3.5" />
            </span>
            <span className="text-paper-dim">{t("voiceChip")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
