"use client";

import posthog from "posthog-js";

/**
 * Product analytics via PostHog (roadmap 3.4). Client-side only, inert
 * without NEXT_PUBLIC_POSTHOG_KEY or without the user's consent. Track product moments, never
 * nutrition values — event properties should say what happened, not
 * what the user ate or weighs.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

let initialized = false;

/** Only after the user accepts analytics in the consent banner. */
export function initAnalytics(): void {
  if (!KEY || initialized || typeof window === "undefined" || readConsent() !== "granted") return;
  posthog.init(KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // SPA navigations don't fire full loads; Analytics component sends
    // $pageview on route changes instead.
    capture_pageview: false,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

/** Ties events to the account (pseudonymous id) and sets cohort properties. */
export function identify(userId: string, props: Record<string, string | number | boolean>): void {
  if (!initialized) return;
  posthog.identify(userId, props);
}

export const CONSENT_COOKIE = "so3ra_consent";

/** "granted" | "denied" | null (not asked yet). */
export function readConsent(): "granted" | "denied" | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )so3ra_consent=(granted|denied)/);
  return (m?.[1] as "granted" | "denied" | undefined) ?? null;
}

export function writeConsent(value: "granted" | "denied" | null): void {
  document.cookie =
    value == null
      ? `${CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
      : `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  window.dispatchEvent(new Event("so3ra-consent"));
}

export function trackPageview(path: string): void {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: window.location.origin + path });
}

/** Fire-and-forget product event; safe to call when analytics is off. */
export function track(event: string, properties?: Record<string, string | number | boolean>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}
