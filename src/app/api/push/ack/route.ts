import { NextResponse, type NextRequest } from "next/server";
import { isPushEndpoint } from "@/lib/push-endpoint";
import { REMINDER_SLOTS } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Delivery receipt from the service worker for a meal reminder. The push
 * endpoint identifies the device (only it and our server know it); only an
 * existing reminder_log row of that device's owner is marked, once.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
    slot?: unknown;
    date?: unknown;
    shown?: unknown;
  } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const slot = typeof body?.slot === "string" ? body.slot : "";
  const date = typeof body?.date === "string" ? body.date : "";
  if (!isPushEndpoint(endpoint) || !(REMINDER_SLOTS as readonly string[]).includes(slot) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  const { data, error } = await db.rpc("ack_reminder", {
    p_endpoint: endpoint,
    p_slot: slot,
    p_date: date,
    p_shown: body?.shown === true,
  });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: data === true });
}
