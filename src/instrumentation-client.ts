import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side error tracking (roadmap 3.4). Inert without
 * NEXT_PUBLIC_SENTRY_DSN.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
