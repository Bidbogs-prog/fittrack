import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

/**
 * i18n (roadmap 2.3): cookie-based locale, no URL restructuring — the
 * app lives at the same paths in every language. English is the
 * default; French and Moroccan Arabic serve the Morocco/Maghreb wedge.
 * Arabic flips the document to RTL in the root layout.
 *
 * Arabic is `ar-MA`, not bare `ar`: Morocco writes Western digits, uses
 * French-style number separators (1.234,5) and Moroccan month names
 * (شتنبر, not سبتمبر). Bare `ar` currently resolves to Latin digits too,
 * but that is a CLDR default we should not bet every number in a calorie
 * tracker on. Verified identical in Node and browser ICU, so numbers are
 * safe to render on both sides of hydration.
 */

export const LOCALES = ["en", "fr", "ar-MA"] as const;
export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALE_COOKIE = "locale";
export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  fr: "Français",
  "ar-MA": "العربية",
};

/** Cookies written before Arabic moved from `ar` to `ar-MA`. */
const LEGACY_LOCALES: Record<string, AppLocale> = { ar: "ar-MA" };

export function resolveLocale(candidate: string | undefined): AppLocale {
  if (candidate && (LOCALES as readonly string[]).includes(candidate)) {
    return candidate as AppLocale;
  }
  return (candidate && LEGACY_LOCALES[candidate]) || DEFAULT_LOCALE;
}

export function isRtl(locale: string): boolean {
  return locale.startsWith("ar");
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
