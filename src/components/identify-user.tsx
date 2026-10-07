"use client";

import { useEffect } from "react";
import { identify } from "@/lib/analytics";

/** Links PostHog events to the account and its cohort (source, invite, plan). */
export function IdentifyUser({
  userId,
  props,
}: {
  userId: string;
  props: Record<string, string | number | boolean>;
}) {
  const key = JSON.stringify(props);
  useEffect(() => {
    const run = () => identify(userId, JSON.parse(key) as Record<string, string | number | boolean>);
    run();
    window.addEventListener("so3ra-consent", run);
    return () => window.removeEventListener("so3ra-consent", run);
  }, [userId, key]);
  return null;
}
