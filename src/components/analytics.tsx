"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { initAnalytics, readConsent, trackPageview } from "@/lib/analytics";

/** Mounts PostHog and reports SPA pageviews. Renders nothing. */
export function Analytics() {
  const pathname = usePathname();

  const [on, setOn] = useState(false);
  useEffect(() => {
    const start = () => {
      initAnalytics();
      setOn(readConsent() === "granted");
    };
    start();
    window.addEventListener("so3ra-consent", start);
    return () => window.removeEventListener("so3ra-consent", start);
  }, []);

  useEffect(() => {
    if (on) trackPageview(pathname);
  }, [pathname, on]);

  return null;
}
