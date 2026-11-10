"use client";

/**
 * Browser side of meal reminders: capability checks and subscribing this
 * device. iPhone only supports Web Push for the installed (Home Screen)
 * app, iOS 16.4+, and only after a user tap.
 */

export type PushSupport = "ok" | "ios-install" | "unsupported" | "denied" | "not-configured";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupport(): PushSupport {
  if (!PUBLIC_KEY) return "not-configured";
  if (isIos() && !isStandalone()) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
}

/** This device's current subscription, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Ask permission (must be called from a tap) and subscribe this device. */
export async function subscribeDevice(): Promise<
  { ok: true; endpoint: string; p256dh: string; auth: string } | { ok: false; reason: "denied" | "failed" }
> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY!) }));
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return { ok: false, reason: "failed" };
    return { ok: true, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
