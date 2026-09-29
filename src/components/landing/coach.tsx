import { getTranslations } from "next-intl/server";

const BARS = [40, 55, 30, 48, 36, 60, 44, 92];

/** The coach section: evidence-grounded, adults only, with a sample exchange. */
export async function CoachSection() {
  const t = await getTranslations("landing.coach");
  return (
    <section
      id="coach"
      className="mx-auto grid max-w-[1200px] scroll-mt-20 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-12 px-6 pt-20 pb-10"
    >
      <div className="flex flex-col gap-4">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h2 className="font-display text-[clamp(34px,4.5vw,52px)] leading-[1.02] font-bold tracking-[-0.04em] text-paper">
          {t("title")}
        </h2>
        <p className="max-w-[48ch] text-[17px] leading-relaxed text-paper-dim">{t("lede")}</p>
        <ul className="flex flex-wrap gap-2">
          {(["tagReport", "tagTdee", "tagPlans", "tagSources"] as const).map((k) => (
            <li key={k} className="rounded-full border border-ink-700 px-3 py-1.5 text-[13px] text-paper-dim">
              {t(k)}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3 rounded-[28px] border border-ink-800 bg-ink-900 p-[22px]">
        <p className="max-w-[80%] self-end rounded-[18px] rounded-ee-md bg-paper px-3.5 py-2.5 text-sm text-ink-950">
          {t("question")}
        </p>
        <p className="text-[15px] leading-relaxed text-paper">
          {t.rich("answer", { b: (c) => <b className="font-medium text-flame-glow">{c}</b> })}
        </p>
        <div aria-hidden className="flex h-14 items-end gap-1 border-b border-dashed border-ink-600">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`flex-1 rounded-sm ${i === BARS.length - 1 ? "bg-flame" : "bg-ink-600"}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <p className="text-[11px] text-paper-mute">{t("source")}</p>
      </div>
    </section>
  );
}
