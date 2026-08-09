import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error tracking (roadmap 3.4). Inert without SENTRY_DSN /
 * NEXT_PUBLIC_SENTRY_DSN in the environment.
 */
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Nutrition data is sensitive — never attach request bodies or PII.
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
