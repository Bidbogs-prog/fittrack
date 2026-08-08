"use client";

import { useEffect } from "react";

/** Registers the service worker (production only — it caches aggressively). */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Install is progressive enhancement; the app works without it.
    });
  }, []);
  return null;
}
