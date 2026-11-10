"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { pushConfigured, pushMessages, sendPush } from "@/lib/push-server";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
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
  userAgent: string;
}): Promise<{ ok: boolean }> {
  const { supabase, userId } = await requireUser();
  if (!pushConfigured()) return { ok: false };
  const endpoint = String(input.endpoint ?? "");
  if (!endpoint.startsWith("https://") || endpoint.length > 1000) return { ok: false };
  const p256dh = String(input.p256dh ?? "").slice(0, 200);
  const auth = String(input.auth ?? "").slice(0, 100);
  if (!p256dh || !auth) return { ok: false };

  // A browser keeps one endpoint per origin; re-subscribing replaces it.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", userId);
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
  const { data: existing } = await supabase.from("reminder_settings").select("user_id").eq("user_id", userId).maybeSingle();
  if (existing) {
    await supabase.from("reminder_settings").update({ enabled: true, timezone, locale, updated_at: new Date().toISOString() }).eq("user_id", userId);
  } else {
    await supabase.from("reminder_settings").insert({ user_id: userId, timezone, locale });
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
export async function saveReminderTimes(formData: FormData): Promise<{ ok: boolean }> {
  const { supabase, userId } = await requireUser();
  const patch: Record<string, string | null> = {};
  for (const slot of ["breakfast", "lunch", "dinner"] as const) {
    const v = String(formData.get(slot) ?? "").trim();
    if (v && !TIME_RE.test(v)) return { ok: false };
    patch[slot] = v || null;
  }
  const { error } = await supabase
    .from("reminder_settings")
    .update({ ...patch, locale: await getLocale(), updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  revalidatePath("/account");
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
