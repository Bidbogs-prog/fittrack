"use client";

import { useState } from "react";
import { Bell, Check } from "@phosphor-icons/react";
import { track } from "@/lib/analytics";
import { useClientValue } from "@/lib/use-client-clock";

/** Per-feature "notify me" (fake door): which premium ideas people actually want. */
export function FeatureInterest({ feature, label, doneLabel }: { feature: string; label: string; doneLabel: string }) {
  const key = `so3ra_feature_${feature}`;
  const remembered = useClientValue(() => localStorage.getItem(key) != null, false);
  const [tapped, setTapped] = useState(false);
  if (remembered || tapped) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-flame">
        <Check weight="bold" className="size-3" />
        {doneLabel}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        track("premium_feature_interest", { feature });
        localStorage.setItem(key, "1");
        setTapped(true);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink-700 px-2 py-0.5 text-[11px] text-paper-dim hover:border-flame/60 hover:text-paper"
    >
      <Bell weight="bold" className="size-3" />
      {label}
    </button>
  );
}
