import { NextResponse, type NextRequest } from "next/server";
import { blockedSlots, dueSlots, type ReminderLogRow, type ReminderSchedule } from "@/lib/reminders";
import { pushConfigured, reminderPayload, sendPush } from "@/lib/push-server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Meal reminder sender (roadmap GTM G3). Called every 5 minutes by a
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
  /** The user's local clock, resolved by Postgres (reminder_candidates). */
  local_date: string;
  local_minutes: number;
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

  // Local clocks come from Postgres: the runtime's Intl timezone data was
  // observed to put Morocco an hour off.
  const { data: settings, error } = await db.rpc("reminder_candidates");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // sent = accepted by the push service (FCM, Apple…), not proof the phone showed it.
  const stats = { users: 0, sent: 0, skipped: 0, gone: 0, failed: 0 };
  const rows = (settings ?? []) as SettingsRow[];
  stats.users = rows.length;

  // First pass with nothing logged/sent: who could be due at all this run.
  const candidates = rows
    .map((s) => {
      const now = { date: String(s.local_date).slice(0, 10), minutes: Number(s.local_minutes) };
      return { s, now, probe: dueSlots(s, now, new Set(), new Set()) };
    })
    .filter((c) => c.probe.slots.length > 0);
  if (candidates.length === 0) return NextResponse.json(stats);

  // Three queries for the whole batch instead of three per user (audit #10e).
  const ids = candidates.map((c) => c.s.user_id);
  const dates = [...new Set(candidates.map((c) => c.probe.date))];
  const [subsRes, loggedRes, sentRes] = await Promise.all([
    db.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", ids),
    db.from("diary_entries").select("user_id, entry_date, meal").in("user_id", ids).in("entry_date", dates),
    db
      .from("reminder_log")
      .select("user_id, local_date, slot, status, attempts, updated_at")
      .in("user_id", ids)
      .in("local_date", dates),
  ]);
  // A failed read is not "nothing logged / nothing sent" (AUD-06): stop.
  const readError = subsRes.error ?? loggedRes.error ?? sentRes.error;
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  const [subs, logged, sent] = [subsRes.data, loggedRes.data, sentRes.data];
  const group = <T,>(list: T[] | null, key: (r: T) => string) => {
    const m = new Map<string, T[]>();
    for (const r of list ?? []) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
    return m;
  };
  const subsBy = group(subs, (r) => r.user_id as string);
  const loggedBy = group(logged, (r) => `${r.user_id}|${r.entry_date}`);
  const sentBy = group(sent, (r) => `${r.user_id}|${String(r.local_date).slice(0, 10)}`);

  const sends: Promise<void>[] = [];
  for (const { s, now, probe } of candidates) {
    const userSubs = subsBy.get(s.user_id) ?? [];
    if (userSubs.length === 0) continue;
    const key = `${s.user_id}|${probe.date}`;
    const { slots } = dueSlots(
      s,
      now,
      new Set((loggedBy.get(key) ?? []).map((r) => r.meal as string)),
      blockedSlots((sentBy.get(key) ?? []) as unknown as ReminderLogRow[])
    );
    stats.skipped += probe.slots.length - slots.length;

    for (const slot of slots) {
      sends.push(
        (async () => {
          // Claim the slot first so overlapping runs can't double-send;
          // the claim only becomes final once a push service accepts it.
          const { data: claimed, error: claimError } = await db.rpc("claim_reminder", {
              p_user: s.user_id,
            p_slot: slot,
            p_date: probe.date,
            });
          if (claimError || claimed !== true) return;
          let accepted = 0;
          let failed = 0;
          for (const sub of userSubs) {
            const r = await sendPush(sub, reminderPayload(slot, s.locale));
            stats[r === "sent" ? "sent" : r === "gone" ? "gone" : "failed"]++;
            if (r === "sent") accepted++;
            if (r === "failed") failed++;
            if (r === "gone") await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
          // Retried by later runs only when something failed and nothing got through;
          // all devices gone = nothing left to retry.
          await db
            .from("reminder_log")
            .update({ status: accepted === 0 && failed > 0 ? "failed" : "sent", updated_at: new Date().toISOString() })
            .eq("user_id", s.user_id)
            .eq("slot", slot)
            .eq("local_date", probe.date);
        })()
      );
    }
  }
  await Promise.all(sends);
  return NextResponse.json(stats);
}
