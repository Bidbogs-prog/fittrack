"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { pushConfigured, pushMessages, sendPush } from "@/lib/push-server";
import { createAdminClient } from "@/lib/supabase/admin";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Device UTC offset in minutes (east positive), or null when missing or out of range. */
const validOffset = (v: unknown): number | null => {
  const n = Number(v);
  return v !== "" && v != null && Number.isInteger(n) && Math.abs(n) <= 840 ? n : null;
};
const validTz = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz.length <= 64;
  } catch {
    return false;
  }
};

/** Store this device's push subscription and make sure reminder settings exist. */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
  /** -Date#getTimezoneOffset(): the clock the user sees, which wins over the zone's tz data. */
  utcOffsetMin?: number;
  userAgent: string;
}): Promise<{ ok: boolean }> {
  const { supabase, userId } = await requireUser();
  if (!pushConfigured()) return { ok: false };
  const endpoint = String(input.endpoint ?? "");
  if (!endpoint.startsWith("https://") || endpoint.length > 1000) return { ok: false };
  const p256dh = String(input.p256dh ?? "").slice(0, 200);
  const auth = String(input.auth ?? "").slice(0, 100);
  if (!p256dh || !auth) return { ok: false };

  // A browser keeps one endpoint per origin; re-subscribing replaces it. On a
  // shared device the endpoint may still belong to the previous account
  // (it never signed out here): the device now belongs to this user, so the
  // old owner stops receiving reminders on it (audit #6). Holding the
  // endpoint is the proof of possession.
  const admin = createAdminClient();
  await (admin ?? supabase).from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    user_agent: String(input.userAgent ?? "").slice(0, 300) || null,
  });
  if (error) return { ok: false };

  const locale = await getLocale();
  const timezone = validTz(String(input.timezone ?? "")) ? input.timezone : "Africa/Casablanca";
  const utc_offset_min = validOffset(input.utcOffsetMin);
  const { data: existing } = await supabase.from("reminder_settings").select("user_id").eq("user_id", userId).maybeSingle();
  if (existing) {
    await supabase
      .from("reminder_settings")
      .update({ enabled: true, timezone, locale, utc_offset_min, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
  } else {
    await supabase.from("reminder_settings").insert({ user_id: userId, timezone, locale, utc_offset_min });
  }
  revalidatePath("/account");
  return { ok: true };
}

/** Remove this device's subscription; reminders stop when no device is left. */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("push_subscriptions").delete().eq("endpoint", String(endpoint ?? "")).eq("user_id", userId);
  revalidatePath("/account");
}

/** Reminder times; an empty field turns that meal's reminder off. */
/**
 * Reminder times; an empty field turns that meal's reminder off. A slot whose
 * time changes can fire again today: its "sent today" mark is cleared (moving
 * breakfast from 09:00 to 10:30 after the 09:00 one went out used to mean no
 * reminder at 10:30).
 */
export async function saveReminderTimes(formData: FormData): Promise<{ ok: boolean }> {
  const { supabase, userId } = await requireUser();
  const patch: Record<string, string | null> = {};
  for (const slot of ["breakfast", "lunch", "dinner"] as const) {
    const v = String(formData.get(slot) ?? "").trim();
    if (v && !TIME_RE.test(v)) return { ok: false };
    patch[slot] = v || null;
  }
  const offset = validOffset(formData.get("offset"));
  const { data: before } = await supabase
    .from("reminder_settings")
    .select("breakfast, lunch, dinner")
    .eq("user_id", userId)
    .maybeSingle();
  const { error } = await supabase
    .from("reminder_settings")
    .update({
      ...patch,
      ...(offset != null ? { utc_offset_min: offset } : {}),
      locale: await getLocale(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (!error && before) {
    const hhmm = (t: unknown) => (typeof t === "string" ? t.slice(0, 5) : null);
    const changed = (["breakfast", "lunch", "dinner"] as const).filter((s) => patch[s] && hhmm(before[s]) !== patch[s]);
    if (changed.length > 0) {
      // reminder_log is service-only. Clear today and yesterday (UTC) so the
      // user's local "today" is covered whatever their offset.
      const now = Date.now();
      const days = [0, 1].map((d) => new Date(now - d * 86_400_000).toISOString().slice(0, 10));
      if (offset != null) days.push(new Date(now + offset * 60_000).toISOString().slice(0, 10));
      await createAdminClient()
        ?.from("reminder_log")
        .delete()
        .eq("user_id", userId)
        .in("slot", changed)
        .in("local_date", [...new Set(days)]);
    }
  }
  revalidatePath("/account");
  return { ok: !error };
}

/** Keep the device's UTC offset current (DST, travel); called on app open when it changes. */
export async function syncReminderClock(input: { timezone: string; utcOffsetMin: number }): Promise<void> {
  const { supabase, userId } = await requireUser();
  const utc_offset_min = validOffset(input.utcOffsetMin);
  if (utc_offset_min == null) return;
  const tz = String(input.timezone ?? "");
  await supabase
    .from("reminder_settings")
    .update({ utc_offset_min, ...(validTz(tz) ? { timezone: tz } : {}) })
    .eq("user_id", userId);
}

/** Send a test notification to every device of the signed-in user. */
export async function sendTestReminder(): Promise<{ sent: number }> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId);
  const m = pushMessages(await getLocale());
  let sent = 0;
  for (const sub of data ?? []) {
    const r = await sendPush(sub, { title: m.testTitle, body: m.testBody, url: "/dashboard", tag: "reminder-test" });
    if (r === "sent") sent++;
    if (r === "gone") await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("user_id", userId);
  }
  return { sent };
}
