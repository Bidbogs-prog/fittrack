"use server";

import { cookies, headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { readSource } from "@/lib/beta";
import { createClient } from "@/lib/supabase/server";

export type WaitlistState =
  | { status: "idle" }
  | { status: "joined"; code: string; position: number; already: boolean }
  | { status: "error"; error: "email" | "captcha" | "rate" | "generic" };

/** Best-effort per-instance throttle; Turnstile is the real bot gate. */
const hits = new Map<string, number[]>();
function throttled(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 5;
}

async function turnstileOk(token: string, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    return false;
  }
}

/** Landing-page waitlist signup (GTM G1). Anonymous; writes via join_waitlist(). */
export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  // Honeypot: humans never fill the hidden "website" field.
  if (String(formData.get("website") ?? "")) return { status: "joined", code: "", position: 0, already: false };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  if (throttled(ip ?? "unknown")) return { status: "error", error: "rate" };
  if (!(await turnstileOk(String(formData.get("cf-turnstile-response") ?? ""), ip))) {
    return { status: "error", error: "captcha" };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) return { status: "error", error: "email" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_waitlist", {
    p_email: email,
    p_locale: await getLocale(),
    p_city: String(formData.get("city") ?? "").slice(0, 80),
    p_phone_os: String(formData.get("phone_os") ?? ""),
    p_health_app: String(formData.get("health_app") ?? "").slice(0, 40),
    p_referred_by: (await cookies()).get("so3ra_ref")?.value ?? "",
    p_source: await readSource(),
  });
  if (error) {
    if (/invalid_email/.test(error.message)) return { status: "error", error: "email" };
    console.error(`[waitlist] ${error.message}`);
    return { status: "error", error: "generic" };
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { referral_code: string; queue_position: number; already: boolean }
    | undefined;
  if (!row) return { status: "error", error: "generic" };
  return { status: "joined", code: row.referral_code, position: row.queue_position, already: row.already };
}
