"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { track } from "@/lib/analytics";
import { useClientValue } from "@/lib/use-client-clock";
import { registerIntent } from "@/app/(app)/account/intent-actions";

/**
 * Fake door (GTM G2): looks like the real button, records intent, then says
 * "coming soon". Remembers the tap locally so it doesn't nag again.
 */
export function IntentButton({
  kind,
  surface,
  label,
  doneLabel,
  initialDone = false,
  className = "",
  children,
}: {
  kind: "premium" | "native";
  surface: string;
  label: string;
  doneLabel: string;
  initialDone?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [tapped, setDone] = useState(false);
  const remembered = useClientValue(() => localStorage.getItem(`so3ra_intent_${kind}`) != null, false);
  const done = initialDone || remembered || tapped;

  if (done) {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-paper-dim" role="status">
        <Check weight="bold" className="size-4 text-flame" />
        {doneLabel}
      </p>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const ua = navigator.userAgent;
        const os = /iphone|ipad|ipod/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : "other";
        track(kind === "premium" ? "premium_intent" : "native_intent", { surface, os });
        localStorage.setItem(`so3ra_intent_${kind}`, "1");
        setDone(true);
        void registerIntent(kind, os).catch(() => {});
      }}
    >
      {children}
      {label}
    </button>
  );
}
