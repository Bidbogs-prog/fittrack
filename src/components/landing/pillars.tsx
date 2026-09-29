import { getTranslations } from "next-intl/server";

/** "The system": a 7 + 5 + 12 bento — targets, per-gram precision, plans. */
export async function Pillars() {
  const t = await getTranslations("landing.system");
  return (
    <section id="system" className="mx-auto max-w-[1200px] scroll-mt-20 px-6 pt-20 pb-10">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h2 className="mt-3.5 mb-3 font-display text-[clamp(34px,4.5vw,52px)] leading-[1.02] font-bold tracking-[-0.04em] text-paper">
        {t("title")}
      </h2>
      <p className="mb-10 max-w-[54ch] text-[17px] leading-relaxed text-paper-dim">{t("lede")}</p>

      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 rounded-3xl border border-ink-800 bg-ink-900 p-7 md:col-span-7">
          <h3 className="font-display text-[22px] font-semibold text-paper">{t("targetsTitle")}</h3>
          <p className="max-w-[52ch] text-sm leading-relaxed text-paper-dim">{t("targetsBody")}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-[22px] gap-y-[18px]" dir="ltr">
            {(
              [
                ["BMR", "1,742", t("restingBurn"), false],
                ["TDEE", "2,700", t("training"), false],
                [t("target"), "2,490", t("leanBulk"), true],
              ] as const
            ).map(([label, value, sub, accent], i) => (
              <div key={label} className="flex items-center gap-[22px]">
                {i > 0 && <span aria-hidden className="text-ink-600">→</span>}
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-paper-mute uppercase">{label}</p>
                  <p className={`font-mono text-[32px] font-semibold tracking-[-0.03em] ${accent ? "text-flame" : "text-paper"}`}>
                    {value}
                  </p>
                  <p className="text-[11px] text-paper-mute">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5 rounded-3xl border border-ink-800 bg-ink-900 p-7 md:col-span-5">
          <h3 className="font-display text-[22px] font-semibold text-paper">{t("gramTitle")}</h3>
          <p className="text-sm leading-relaxed text-paper-dim">{t("gramBody")}</p>
          <div className="flex flex-col gap-2.5 rounded-2xl border border-ink-700 bg-ink-950 p-3.5">
            <div className="flex justify-between text-sm">
              <span className="text-paper">{t("rice")}</span>
              <span className="font-mono text-base font-semibold text-flame">137 g</span>
            </div>
            <dl className="grid grid-cols-[14px_minmax(0,1fr)_54px] items-center gap-2.5 font-mono text-[11px] text-paper-mute" dir="ltr">
              {(
                [
                  ["P", 34, "3.7 g", "bg-protein"],
                  ["C", 86, "38.4 g", "bg-carbs"],
                  ["F", 9, "0.4 g", "bg-fat"],
                ] as const
              ).map(([k, w, v, color]) => (
                <div key={k} className="contents">
                  <dt>{k}</dt>
                  <span className="h-[5px] rounded-full bg-ink-800">
                    <span className={`block h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
                  </span>
                  <dd className="text-end text-paper-dim">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-center gap-7 rounded-3xl border border-ink-800 bg-[linear-gradient(120deg,rgba(255,157,59,0.08),var(--ink-900)_50%)] p-7 md:col-span-12">
          <div>
            <h3 className="font-display text-[22px] font-semibold text-paper">{t("plansTitle")}</h3>
            <p className="mt-2.5 max-w-[46ch] text-sm leading-relaxed text-paper-dim">{t("plansBody")}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                [t("planCut"), "1,980", "186", false],
                [t("planMaintain"), "2,510", "168", false],
                [t("planBuild"), "2,960", "197", true],
              ] as const
            ).map(([name, kcal, protein, accent]) => (
              <div
                key={name}
                className={`rounded-2xl border bg-ink-950 p-3.5 ${accent ? "border-flame/40" : "border-ink-700"}`}
              >
                <p className="text-[13px] text-paper">{name}</p>
                <p className={`mt-1.5 font-mono text-2xl font-semibold ${accent ? "text-flame" : "text-paper"}`}>{kcal}</p>
                <p className="text-[11px] text-paper-mute">kcal · {protein} g P</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
