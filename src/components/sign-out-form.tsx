"use client";

import { signout } from "@/app/(auth)/actions";
import { removePushSubscription } from "@/app/(app)/account/reminder-actions";

/**
 * Before signing out, clear what this device keeps about the account
 * (audit #6): the service worker's cached pages (readable offline by the next
 * person on a shared phone) and this device's push subscription (otherwise
 * it keeps receiving the previous user's meal reminders). Best-effort — sign
 * out always proceeds.
 */
async function forgetThisDevice(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("so3ra-pages-")).map((k) => caches.delete(k)));
    }
  } catch {
    // ignore
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    // ignore
  }
}

export function SignOutForm({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <form
      className={className}
      action={async () => {
        await forgetThisDevice();
        await signout();
      }}
    >
      {children}
    </form>
  );
}
