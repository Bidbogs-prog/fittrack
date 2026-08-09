"use client";

import posthog from "posthog-js";

/**
 * Product analytics via PostHog (roadmap 3.4). Client-side only, inert
 * without NEXT_PUBLIC_POSTHOG_KEY. Track product moments, never
 * nutrition values — event properties should say what happened, not
 * what the user ate or weighs.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

let initialized = false;

export function initAnalytics(): void {
  if (!KEY || initialized || typeof window === "undefined") return;
  posthog.init(KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // SPA navigations don't fire full loads; Analytics component sends
    // $pageview on route changes instead.
    capture_pageview: false,
    persistence: "localStorage+cookie",
  });
  initialized = true;
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
