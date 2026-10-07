"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

const DAYS_90 = 60 * 60 * 24 * 90;

/**
 * First-touch attribution for the beta: utm_*, ?ref (waitlist referral) and
 * ?code (invite) go into first-party cookies the server reads at signup.
 * Also reports PWA installs (events only send after analytics consent).
 */
export function SourceCapture() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    if (code && /^[A-Za-z0-9-]{4,32}$/.test(code)) {
      document.cookie = `so3ra_invite=${code.toUpperCase()}; Path=/; Max-Age=${DAYS_90}; SameSite=Lax`;
    }
    const ref = q.get("ref");
    if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref)) {
      document.cookie = `so3ra_ref=${ref.toUpperCase()}; Path=/; Max-Age=${DAYS_90}; SameSite=Lax`;
    }
    if (!/(?:^|; )so3ra_src=/.test(document.cookie)) {
      const src: Record<string, string> = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"]) {
        const v = q.get(k);
        if (v) src[k] = v.slice(0, 100);
      }
      if (code) src.code = code.slice(0, 32).toUpperCase();
      if (document.referrer && !document.referrer.startsWith(window.location.origin)) {
        try {
          src.referrer = new URL(document.referrer).hostname.slice(0, 100);
        } catch {
          // ignore malformed referrers
        }
      }
      src.landing = window.location.pathname.slice(0, 100);
      document.cookie = `so3ra_src=${encodeURIComponent(JSON.stringify(src))}; Path=/; Max-Age=${DAYS_90}; SameSite=Lax`;
    }

    const ua = navigator.userAgent;
    const os = /iphone|ipad|ipod/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : "other";
    const onInstalled = () => track("pwa_installed", { os });
    window.addEventListener("appinstalled", onInstalled);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone && !localStorage.getItem("so3ra_pwa_seen")) {
      // iOS has no appinstalled event: the first standalone launch stands in.
      const t = window.setTimeout(() => {
        localStorage.setItem("so3ra_pwa_seen", "1");
        track("pwa_launched_standalone", { os });
      }, 1500);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);
  return null;
}
