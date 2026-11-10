import webpush from "web-push";
import ar from "../../messages/ar-MA.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import type { ReminderSlot } from "./reminders";

/**
 * Web Push sending (server-only). Keys: NEXT_PUBLIC_VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_KEY, optional VAPID_SUBJECT (mailto: contact). Generate a
 * pair with `npx web-push generate-vapid-keys`.
 */

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured != null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@so3ra.app", pub, priv);
  return (configured = true);
}

/** "sent", "gone" (subscription expired — delete it) or "failed". */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<"sent" | "gone" | "failed"> {
  if (!pushConfigured()) return "failed";
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60, urgency: "normal" }
    );
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error(`[push] send failed (${status ?? "network"})`);
    return "failed";
  }
}

const CATALOGUES = { en, fr, "ar-MA": ar } as const;
type PushMessages = { title: Record<ReminderSlot, string>; body: Record<ReminderSlot, string>; testTitle: string; testBody: string };

export function pushMessages(locale: string): PushMessages {
  const cat = CATALOGUES[locale as keyof typeof CATALOGUES] ?? en;
  return (cat as unknown as { pushNotify: PushMessages }).pushNotify;
}

export function reminderPayload(slot: ReminderSlot, locale: string): PushPayload {
  const m = pushMessages(locale);
  return { title: m.title[slot], body: m.body[slot], url: "/dashboard", tag: `reminder-${slot}` };
}
