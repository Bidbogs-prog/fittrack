import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { setLocalePublic } from "@/app/locale-actions";
import { LOCALES } from "@/i18n/request";

const SHORT: Record<string, string> = { en: "EN", fr: "FR", "ar-MA": "ع" };

/** Sticky blurred bar: sections, language, log in, start. */
export async function LandingNav() {
  const [t, locale] = await Promise.all([getTranslations("landing.nav"), getLocale()]);
  return (
    <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/70 backdrop-blur-[14px]">
      <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-6 py-3.5">
        <Logo />
        <nav aria-label={t("sections")} className="flex flex-1 gap-[22px] text-sm text-paper-dim max-md:hidden">
          <a href="#how" className="hover:text-paper">{t("how")}</a>
          <a href="#system" className="hover:text-paper">{t("system")}</a>
          <a href="#coach" className="hover:text-paper">{t("coach")}</a>
          <a href="#faq" className="hover:text-paper">{t("faq")}</a>
        </nav>
        <div className="flex items-center gap-2.5 text-[13px] max-md:ms-auto">
          <form action={setLocalePublic} className="flex items-center text-paper-mute max-sm:hidden">
            <input type="hidden" name="back" value="/" />
            {LOCALES.map((code, i) => (
              <span key={code} className="flex items-center">
                {i > 0 && <span aria-hidden>·</span>}
                <button
                  type="submit"
                  name="locale"
                  value={code}
                  lang={code}
                  aria-pressed={locale === code}
                  className={`min-h-9 px-1.5 ${locale === code ? "text-paper" : "hover:text-paper"}`}
                >
                  {SHORT[code]}
                </button>
              </span>
            ))}
          </form>
          <Link href="/login" className="inline-flex min-h-10 items-center px-3 text-paper hover:text-flame-glow">
            {t("login")}
          </Link>
          <Link href="/signup" className="btn-flame btn-press inline-flex min-h-10 items-center rounded-xl px-4">
            {t("start")}
          </Link>
        </div>
      </div>
    </header>
  );
}
