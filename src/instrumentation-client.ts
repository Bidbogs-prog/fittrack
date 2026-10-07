import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side error tracking (roadmap 3.4). Inert without
 * NEXT_PUBLIC_SENTRY_DSN.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
// Consent-gated like analytics: starts on the first page load after the
// user accepts in the banner.
const consented = typeof document !== "undefined" && /(?:^|; )so3ra_consent=granted/.test(document.cookie);

if (dsn && consented) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
