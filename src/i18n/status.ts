/**
 * Status messages travel through the URL as KEYS, not prose (roadmap 2.3).
 *
 * A server action can't know the reader's language when it redirects, and
 * `?error=Password%20must%20be...` renders English into an Arabic page. The
 * action names the outcome; the page translates it under the `status`
 * namespace.
 *
 * The allowlist matters: `searchParams` is attacker-controlled, so an
 * unvalidated key would let a crafted link render any string in our message
 * catalogue inside our own error styling.
 */

export const STATUS_KEYS = [
  // auth
  "invalidCredentials",
  "emailNotConfirmed",
  "emailTaken",
  "emailInvalid",
  "passwordTooShort",
  "samePassword",
  "rateLimited",
  "signupDisabled",
  "userBanned",
  "sessionExpired",
  "enterEmail",
  "unknownProvider",
  "checkEmail",
  "resetLinkSent",
  "passwordUpdated",
  // onboarding
  "checkYourDetails",
  "couldNotSave",
  // fallback
  "generic",
] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];

const KEYS = new Set<string>(STATUS_KEYS);

/** Narrow a `searchParams` value to a key we are willing to render. */
export function toStatusKey(value: string | undefined): StatusKey | undefined {
  return value && KEYS.has(value) ? (value as StatusKey) : undefined;
}

/**
 * Redirect target carrying a status key. Typed so a mistyped key is a build
 * error rather than a page that silently falls back to the generic message.
 */
export function statusUrl(path: string, kind: "error" | "message", key: StatusKey): string {
  return `${path}?${kind}=${key}`;
}

/**
 * Supabase auth errors are English strings from an external service, so they
 * can't be translated directly. Map the codes we can name and fall back to a
 * generic message rather than leaking English into a translated page.
 */
const AUTH_CODES: Record<string, StatusKey> = {
  invalid_credentials: "invalidCredentials",
  email_not_confirmed: "emailNotConfirmed",
  email_exists: "emailTaken",
  user_already_exists: "emailTaken",
  email_address_invalid: "emailInvalid",
  weak_password: "passwordTooShort",
  same_password: "samePassword",
  over_request_rate_limit: "rateLimited",
  over_email_send_rate_limit: "rateLimited",
  signup_disabled: "signupDisabled",
  user_banned: "userBanned",
  session_expired: "sessionExpired",
  session_not_found: "sessionExpired",
};

export function authErrorKey(error: { code?: string } | null | undefined): StatusKey {
  return (error?.code && AUTH_CODES[error.code]) || "generic";
}
