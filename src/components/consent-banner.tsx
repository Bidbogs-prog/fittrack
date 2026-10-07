"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { readConsent, writeConsent } from "@/lib/analytics";

/**
 * Asks once before PostHog and Sentry load (CNIL / CNDP). Sign-in, language
 * and attribution cookies are first-party and functional, so they don't wait.
 */
export function ConsentBanner() {
  const t = useTranslations("consent");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(readConsent() == null);
    check();
    window.addEventListener("so3ra-consent", check);
    return () => window.removeEventListener("so3ra-consent", check);
  }, []);
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      className="dialog-pop fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-4 shadow-float sm:flex-row sm:items-center"
    >
      <p className="flex-1 text-[13px] leading-relaxed text-paper-dim">
        {t("body")}{" "}
        <Link href="/privacy" className="text-flame underline underline-offset-2">
          {t("learnMore")}
        </Link>
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => writeConsent("denied")}
          className="btn-press min-h-10 rounded-xl border border-ink-700 px-4 text-sm font-medium text-paper-dim hover:text-paper"
        >
          {t("decline")}
        </button>
        <button
          type="button"
          onClick={() => writeConsent("granted")}
          className="btn-press btn-flame min-h-10 rounded-xl px-4 text-sm font-semibold"
        >
          {t("accept")}
        </button>
      </div>
    </div>
  );
}

/** For the legal pages: reopen the choice. */
export function ConsentReset() {
  const t = useTranslations("consent");
  return (
    <button type="button" onClick={() => writeConsent(null)} className="hover:text-paper">
      {t("change")}
    </button>
  );
}
