"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudArrowUp } from "@phosphor-icons/react";
import { readQueue, removeFromQueue, type QueuedEntry } from "@/lib/offline-queue";
import { addDiaryEntry, addQuickEntry, addRecipeEntry, applySavedMeal } from "./actions";

async function replay(entry: QueuedEntry): Promise<{ error: string | null } | undefined> {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entry.fields)) fd.set(key, value);
  if (entry.kind === "food") return addDiaryEntry(fd);
  if (entry.kind === "recipe") return addRecipeEntry(fd);
  if (entry.kind === "savedMeal") return applySavedMeal(fd);
  return addQuickEntry(fd);
}

/**
 * Flushes the offline diary queue (roadmap 2.1): on mount and whenever
 * the connection returns, queued entries replay through the same server
 * actions they failed on. Renders a banner while anything is waiting.
 */
export function OfflineSync() {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);

  const flush = useCallback(async () => {
    if (busy.current) return;
    const queue = readQueue();
    setPendingCount(queue.length);
    if (queue.length === 0 || !navigator.onLine) return;

    busy.current = true;
    setSyncing(true);
    let synced = 0;
    for (const entry of queue) {
      try {
        const res = await replay(entry);
        // Success — or a validation error, which will never succeed on
        // retry, so drop it either way rather than loop forever.
        removeFromQueue(entry.id);
        if (!res?.error) synced += 1;
      } catch {
        break; // still offline — keep the rest for the next attempt
      }
    }
    busy.current = false;
    setSyncing(false);
    setPendingCount(readQueue().length);
    if (synced > 0) router.refresh();
  }, [router]);

  useEffect(() => {
    // Deferred a tick: flush sets state, which effects shouldn't do
    // synchronously (react-hooks/set-state-in-effect).
    const initial = setTimeout(() => void flush(), 0);
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("online", onOnline);
    };
  }, [flush]);

  if (pendingCount === 0) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl border border-lime/25 bg-lime/[0.06] px-4 py-3 text-sm text-paper-dim"
    >
      <CloudArrowUp
        weight="bold"
        className={`size-4.5 shrink-0 text-lime ${syncing ? "animate-pulse" : ""}`}
      />
      <span className="min-w-0 flex-1">
        {pendingCount} {pendingCount === 1 ? "entry" : "entries"} logged offline
        {syncing ? " — syncing…" : " — will sync when you're back online."}
      </span>
      {!syncing && (
        <button
          type="button"
          onClick={() => void flush()}
          className="btn-press shrink-0 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-paper-dim hover:border-lime/50 hover:text-lime"
        >
          Retry now
        </button>
      )}
    </div>
  );
}
