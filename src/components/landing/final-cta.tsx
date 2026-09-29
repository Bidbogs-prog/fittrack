import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function FinalCta() {
  const t = await getTranslations("landing.cta");
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-20">
      <div className="flex flex-col items-start gap-5 rounded-[32px] border border-flame/25 bg-[radial-gradient(600px_300px_at_80%_20%,rgba(255,201,77,0.18),transparent_60%),linear-gradient(135deg,#2a1608,var(--ink-900)_60%)] p-[clamp(32px,6vw,72px)]">
        <h2 className="max-w-[14ch] font-display text-[clamp(38px,5.5vw,68px)] leading-[0.98] font-bold tracking-[-0.05em] text-paper">
          {t("title")}
        </h2>
        <p className="text-[17px] text-paper-dim">{t("body")}</p>
        <Link href="/signup" className="btn-flame btn-press glow-flame inline-flex min-h-[52px] items-center rounded-[14px] px-[26px] text-base">
          {t("button")} <span aria-hidden className="ms-1.5 rtl:-scale-x-100">→</span>
        </Link>
      </div>
    </section>
  );
}
