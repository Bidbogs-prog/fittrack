import { getTranslations } from "next-intl/server";
import { Waitlist } from "./waitlist";

export async function WaitlistSection() {
  const t = await getTranslations("waitlist");
  return (
    <section id="waitlist" className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-6 py-16">
      <div className="grid gap-8 rounded-[28px] border border-ink-800 bg-ink-900 p-[clamp(24px,5vw,56px)] lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-[0.14em] text-flame uppercase">{t("eyebrow")}</p>
          <h2 className="font-display text-[clamp(30px,4vw,48px)] leading-[1.02] font-bold tracking-[-0.04em] text-paper">
            {t("title")}
          </h2>
          <p className="text-paper-dim">{t("body")}</p>
        </div>
        <Waitlist />
      </div>
    </section>
  );
}
