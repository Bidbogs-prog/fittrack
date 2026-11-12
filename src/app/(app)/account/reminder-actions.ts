"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { pushConfigured, pushMessages, sendPush } from "@/lib/push-server";
import { isPushEndpoint, isPushKeys } from "@/lib/push-endpoint";
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
  const p256dh = String(input.p256dh ?? "");
  const auth = String(input.auth ?? "");
  // Only real push services, with well-formed keys (AUD-07: the server sends
  // requests to this URL).
  if (!isPushEndpoint(endpoint) || !isPushKeys(p256dh, auth)) return { ok: false };
  const user_agent = String(input.userAgent ?? "").slice(0, 300) || null;

  // A browser keeps one subscription per origin, so on a shared device the
  // same endpoint can still be registered to the previous account (audit #6).
  // It moves to this user only with the same keys, i.e. from that browser:
  // knowing someone's endpoint alone can't delete their reminders (AUD-08).
  // Nothing is removed before the new row is valid.
  const admin = createAdminClient();
  if (!admin) return { ok: false };
  const { data: existing, error: readError } = await admin
    .from("push_subscriptions")
    .select("user_id, p256dh, auth")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (readError) return { ok: false };
  if (existing) {
    const sameUser = existing.user_id === userId;
    const sameDevice = existing.p256dh === p256dh && existing.auth === auth;
    if (!sameUser && !sameDevice) return { ok: false };
    const { error } = await admin
      .from("push_subscriptions")
      .update({ user_id: userId, p256dh, auth, user_agent })
      .eq("endpoint", endpoint);
    if (error) return { ok: false };
  } else {
    const { error } = await supabase.from("push_subscriptions").insert({ user_id: userId, endpoint, p256dh, auth, user_agent });
    if (error) return { ok: false };
  }

  const locale = await getLocale();
  const timezone = validTz(String(input.timezone ?? "")) ? input.timezone : "Africa/Casablanca";
  const utc_offset_min = validOffset(input.utcOffsetMin);
  const { data: settings } = await supabase.from("reminder_settings").select("user_id").eq("user_id", userId).maybeSingle();
  const { error: settingsError } = settings
    ? await supabase
        .from("reminder_settings")
        .update({ enabled: true, timezone, locale, utc_offset_min, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
    : await supabase.from("reminder_settings").insert({ user_id: userId, timezone, locale, utc_offset_min });
  // Without settings the cron never picks this user up: don't report success.
  if (settingsError) return { ok: false };
  revalidatePath("/account");
  return { ok: true };
}

/** Remove this device's subscription; reminders stop when no device is left. */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("push_subscriptions").delete().eq("endpoint", String(endpoint ?? "")).eq("user_id", userId);
  revalidatePath("/account");
}

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

/**
 * Keep the account's reminder clock on the phone's current UTC offset (DST,
 * travel); called on app open and when the app comes back to the
 * foreground, whenever this account's cached offset differs (AUD-12).
 * Reports whether it was saved so the client only caches a real write.
 */
export async function syncReminderClock(input: { timezone: string; utcOffsetMin: number }): Promise<{ ok: boolean }> {
  const { supabase, userId } = await requireUser();
  const utc_offset_min = validOffset(input.utcOffsetMin);
  if (utc_offset_min == null) return { ok: false };
  const tz = String(input.timezone ?? "");
  const { error } = await supabase
    .from("reminder_settings")
    .update({ utc_offset_min, ...(validTz(tz) ? { timezone: tz } : {}) })
    .eq("user_id", userId);
  return { ok: !error };
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
