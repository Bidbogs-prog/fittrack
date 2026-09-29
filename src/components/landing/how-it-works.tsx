import { ArrowUp } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { MiniDial } from "@/components/orbit/orbit";

/** Say it → it lands on your orbit → the coach closes the gap. */
export async function HowItWorks() {
  const t = await getTranslations("landing.how");
  const card = "flex flex-col gap-3.5 rounded-3xl border border-ink-800 bg-ink-900 p-6";
  return (
    <section id="how" className="mx-auto max-w-[1200px] scroll-mt-20 px-6 pt-24 pb-10">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h2 className="mt-3.5 mb-10 max-w-[18ch] font-display text-[clamp(34px,4.5vw,52px)] leading-[1.02] font-bold tracking-[-0.04em] text-paper">
        {t("title")}
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-[18px]">
        <div className={card}>
          <p className="font-mono text-xs font-medium text-paper-mute">01</p>
          <div className="flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-850 py-2 ps-3.5 pe-2 text-[13px] text-paper-mute">
            <span className="flex-1">{t("oneExample")}</span>
            <span className="grid size-[30px] place-items-center rounded-[10px] bg-[linear-gradient(135deg,#ffc94d,#f2701f)] text-flame-ink">
              <ArrowUp weight="bold" className="size-4" />
            </span>
          </div>
          <h3 className="font-display text-xl font-semibold text-paper">{t("oneTitle")}</h3>
          <p className="text-sm leading-relaxed text-paper-dim">{t("oneBody")}</p>
        </div>
        <div className={card}>
          <p className="font-mono text-xs font-medium text-paper-mute">02</p>
          <div className="grid h-[78px] place-items-center">
            <MiniDial fraction={0.67} size={78} stroke={4} />
          </div>
          <h3 className="font-display text-xl font-semibold text-paper">{t("twoTitle")}</h3>
          <p className="text-sm leading-relaxed text-paper-dim">{t("twoBody")}</p>
        </div>
        <div className={card}>
          <p className="font-mono text-xs font-medium text-paper-mute">03</p>
          <p className="nudge rounded-2xl px-3.5 py-3 text-[13px] leading-snug text-paper">
            {t.rich("threeExample", { b: (c) => <b className="font-semibold text-flame-glow">{c}</b> })}
          </p>
          <h3 className="font-display text-xl font-semibold text-paper">{t("threeTitle")}</h3>
          <p className="text-sm leading-relaxed text-paper-dim">{t("threeBody")}</p>
        </div>
      </div>
    </section>
  );
}
