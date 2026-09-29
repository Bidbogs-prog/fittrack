"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { logWater } from "@/app/(app)/dashboard/actions";
import { track } from "@/lib/analytics";
import { ComposerChip } from "./composer";

/** "+250 ml water" in the composer rail. */
export function WaterChip({ date }: { date: string }) {
  const t = useTranslations("composer");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(0);
  return (
    <ComposerChip
      tone="water"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await logWater({ date, delta: 250 });
          if (!res.error) {
            setDone((n) => n + 1);
            track("water_logged", { ml: 250 });
          }
        })
      }
    >
      {t("water")}
      {done > 0 && <span className="ms-1 font-mono text-[10px] text-paper-mute">×{done}</span>}
    </ComposerChip>
  );
}
