"use client";

import { useSyncExternalStore } from "react";
import { minutesOfDate } from "./day-time";

/**
 * Browser-only values without a mount flash of setState-in-effect: the
 * server snapshot is null, the client reads the real value on hydration.
 */

function subscribeMinute(onChange: () => void): () => void {
  const id = setInterval(onChange, 20_000);
  return () => clearInterval(id);
}

/** The viewer's local minute-of-day; null during SSR. Ticks each minute. */
export function useNowMinutes(): number | null {
  return useSyncExternalStore(
    subscribeMinute,
    () => minutesOfDate(new Date()),
    () => null
  );
}

const noopSubscribe = () => () => {};

/** A one-shot client value (feature detection etc.); `server` during SSR. */
export function useClientValue<T extends string | number | boolean | null>(
  read: () => T,
  server: T
): T {
  return useSyncExternalStore(noopSubscribe, read, () => server);
}
