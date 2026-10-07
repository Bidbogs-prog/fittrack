"use client";

import Link from "next/link";
import Script from "next/script";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, ShareNetwork } from "@phosphor-icons/react";
import { track } from "@/lib/analytics";
import { joinWaitlist, type WaitlistState } from "@/app/waitlist-actions";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Landing waitlist (GTM G1): email + a few cohort questions; shows the referral link after. */
export function Waitlist() {
  const t = useTranslations("waitlist");
  const [state, action, pending] = useActionState<WaitlistState, FormData>(async (prev, fd) => {
    const res = await joinWaitlist(prev, fd);
    if (res.status === "joined" && res.code) track("waitlist_joined", { already: res.already });
    return res;
  }, { status: "idle" });
  const [copied, setCopied] = useState(false);

  if (state.status === "joined" && state.code) {
    const link = `${window.location.origin}/?ref=${state.code}`;
    const canShare = typeof navigator.share === "function";
    const share = async () => {
      track("waitlist_share", {});
      if (canShare) {
        await navigator.share({ title: "So3ra", text: t("shareText"), url: link }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      }
    };
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="flex items-center gap-2 font-display text-2xl font-semibold text-paper">
          <Check weight="bold" className="size-6 text-flame" />
          {state.already ? t("alreadyTitle") : t("joinedTitle")}
        </p>
        {state.position > 0 && (
          <p className="text-paper-dim">{t("position", { position: state.position })}</p>
        )}
        <p className="text-sm text-paper-dim">{t("referBody")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code dir="ltr" className="min-w-0 flex-1 truncate rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 font-mono text-sm text-paper">
            {link}
          </code>
          <button type="button" onClick={share} className="btn-press btn-flame inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold">
            {copied ? <Check weight="bold" className="size-4" /> : canShare ? <ShareNetwork weight="bold" className="size-4" /> : <Copy weight="bold" className="size-4" />}
            {copied ? t("copied") : t("share")}
          </button>
        </div>
      </div>
    );
  }

  const error = state.status === "error" ? t(`errors.${state.error}`) : null;
  const select = "field appearance-none";

  return (
    <form action={action} className="flex flex-col gap-4">
      {SITE_KEY && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2">
          <span className="field-label">{t("email")}</span>
          <input name="email" type="email" required autoComplete="email" className="field" placeholder="you@example.com" />
        </label>
        <label className="space-y-1.5">
          <span className="field-label">{t("city")}</span>
          <input name="city" autoComplete="address-level2" className="field" placeholder={t("cityPlaceholder")} />
        </label>
        <label className="space-y-1.5">
          <span className="field-label">{t("phone")}</span>
          <select name="phone_os" defaultValue="" className={select}>
            <option value="" disabled>
              {t("choose")}
            </option>
            <option value="ios">iPhone</option>
            <option value="android">Android</option>
            <option value="other">{t("other")}</option>
          </select>
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="field-label">{t("healthApp")}</span>
          <select name="health_app" defaultValue="" className={select}>
            <option value="">{t("none")}</option>
            <option value="apple_health">Apple Health</option>
            <option value="health_connect">Health Connect / Google Fit</option>
            <option value="samsung_health">Samsung Health</option>
            <option value="myfitnesspal">MyFitnessPal</option>
            <option value="other">{t("other")}</option>
          </select>
        </label>
      </div>
      {/* Honeypot */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -start-[9999px] size-px opacity-0" />
      {SITE_KEY && <div className="cf-turnstile" data-sitekey={SITE_KEY} data-theme="dark" />}
      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/[0.08] px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="submit" disabled={pending} className="btn-press btn-flame inline-flex min-h-[52px] items-center rounded-[14px] px-[26px] text-base disabled:opacity-60">
          {pending ? t("joining") : t("submit")}
        </button>
        <Link href="/signup" className="text-sm text-paper-dim underline-offset-4 hover:text-paper hover:underline">
          {t("haveCode")}
        </Link>
      </div>
      <p className="text-xs text-paper-mute">
        {t.rich("legal", { privacy: (c) => <Link href="/privacy" className="underline underline-offset-2">{c}</Link> })}
      </p>
    </form>
  );
}
