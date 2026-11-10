import { NextResponse, type NextRequest } from "next/server";
import { dueSlots, type ReminderSchedule } from "@/lib/reminders";
import { pushConfigured, reminderPayload, sendPush } from "@/lib/push-server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Meal reminder sender (roadmap GTM G3). Called every 15–30 minutes by a
 * scheduler with `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends
 * this automatically; a Supabase pg_cron job can too). For each user with
 * reminders on and at least one device: send the slots that are due in
 * their timezone and not already logged, once per slot per local day.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SettingsRow extends ReminderSchedule {
  user_id: string;
  locale: string;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  if (!db || !pushConfigured()) {
    return NextResponse.json({ error: "not configured (SUPABASE_SECRET_KEY / VAPID keys)" }, { status: 503 });
  }

  const now = new Date();
  const { data: settings, error } = await db
    .from("reminder_settings")
    .select("user_id, timezone, locale, breakfast, lunch, dinner")
    .eq("enabled", true)
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stats = { users: 0, sent: 0, skipped: 0, gone: 0, failed: 0 };
  for (const s of (settings ?? []) as SettingsRow[]) {
    stats.users++;
    // First pass with nothing logged/sent tells us whether anything could be due at all.
    const probe = dueSlots(s, now, new Set(), new Set());
    if (probe.slots.length === 0) continue;

    const [{ data: subs }, { data: logged }, { data: sent }] = await Promise.all([
      db.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", s.user_id),
      db.from("diary_entries").select("meal").eq("user_id", s.user_id).eq("entry_date", probe.date),
      db.from("reminder_log").select("slot").eq("user_id", s.user_id).eq("local_date", probe.date),
    ]);
    if (!subs?.length) continue;
    const { slots } = dueSlots(
      s,
      now,
      new Set((logged ?? []).map((r) => r.meal as string)),
      new Set((sent ?? []).map((r) => r.slot as string))
    );
    stats.skipped += probe.slots.length - slots.length;

    for (const slot of slots) {
      // Claim the slot first so overlapping runs can't double-send.
      const { error: claimError } = await db.from("reminder_log").insert({ user_id: s.user_id, slot, local_date: probe.date });
      if (claimError) continue;
      for (const sub of subs) {
        const r = await sendPush(sub, reminderPayload(slot, s.locale));
        stats[r === "sent" ? "sent" : r === "gone" ? "gone" : "failed"]++;
        if (r === "gone") await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }
  return NextResponse.json(stats);
}
