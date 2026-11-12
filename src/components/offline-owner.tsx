"use client";

import { useEffect } from "react";
import { setQueueOwner } from "@/lib/offline-queue";

/** Tells the offline queue which account is signed in on this device (AUD-03). */
export function OfflineOwner({ userId }: { userId: string }) {
  useEffect(() => setQueueOwner(userId), [userId]);
  return null;
}
