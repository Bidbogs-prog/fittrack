/**
 * Same-origin redirect targets for ?next= parameters (login, OAuth callback,
 * email confirmation, Google sign-in). Resolving against a fixed origin and
 * comparing origins catches every off-site form a prefix check misses —
 * "//evil.com", "/\\evil.com", "https://evil.com", and "/\t/evil.com"
 * (URL parsers strip tabs/newlines, turning it into "//evil.com").
 */
const BASE = "https://so3ra.invalid";

export function safeRedirectPath(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || raw === "" || !raw.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  return url.pathname + url.search + url.hash;
}
