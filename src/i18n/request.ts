import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

/**
 * i18n (roadmap 2.3): cookie-based locale, no URL restructuring — the
 * app lives at the same paths in every language. English is the
 * default; French and Arabic serve the Morocco/Maghreb wedge. Arabic
 * flips the document to RTL in the root layout.
 */

export const LOCALES = ["en", "fr", "ar"] as const;
export type AppLocale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "locale";
export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export default getRequestConfig(async () => {
  const store = await cookies();
  const candidate = store.get(LOCALE_COOKIE)?.value ?? "";
  const locale = (LOCALES as readonly string[]).includes(candidate)
    ? (candidate as AppLocale)
    : "en";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
