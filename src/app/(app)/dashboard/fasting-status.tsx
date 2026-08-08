"use client";

import { useEffect, useState } from "react";

/**
 * Live open/closed state for the user's eating window. Rendered only
 * after mount (the server can't know the viewer's local time), so SSR
 * shows just the window range.
 */
export function FastingStatus({ start, end }: { start: string; end: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  if (now == null) return null;

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const s = toMinutes(start);
  const e = toMinutes(end);
  // start > end wraps midnight (e.g. 20:00 – 04:00).
  const open = s <= e ? now >= s && now < e : now >= s || now < e;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset ${
        open ? "bg-lime/10 text-lime ring-lime/25" : "bg-ink-800 text-paper-mute ring-ink-700"
      }`}
    >
      {open ? `Open until ${end.slice(0, 5)}` : `Fasting until ${start.slice(0, 5)}`}
    </span>
  );
}
