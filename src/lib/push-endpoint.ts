/**
 * Web Push subscription validation (AUD-07). The server POSTs to whatever
 * endpoint a browser hands us, so only real push services are accepted:
 * anything else would let a signed-in user make our server call an
 * arbitrary URL (SSRF).
 */

/** Hosts of the push services browsers actually use. Suffixes match subdomains. */
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com"];
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export function isPushEndpoint(raw: string): boolean {
  if (typeof raw !== "string" || raw.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (url.port !== "" && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s) && host.length > s.length);
}

function base64urlBytes(s: string): Uint8Array | null {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(s)) return null;
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** p256dh: uncompressed P-256 point (65 bytes, 0x04 prefix); auth: 16-byte secret. */
export function isPushKeys(p256dh: string, auth: string): boolean {
  const key = base64urlBytes(p256dh);
  const secret = base64urlBytes(auth);
  return key != null && key.length === 65 && key[0] === 4 && secret != null && secret.length === 16;
}
