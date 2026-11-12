"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CloudArrowUp, WarningCircle } from "@phosphor-icons/react";
import { toStatusKey } from "@/i18n/status";
import {
  adoptLegacyQueue,
  clearFailed,
  discardLegacyQueue,
  markFailed,
  readLegacyQueue,
  readQueue,
  removeFromQueue,
  setQueueOwner,
  type QueuedEntry,
} from "@/lib/offline-queue";
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
 * Flushes this account's offline diary queue (roadmap 2.1, AUD-03/04): on
 * mount and whenever the connection returns. Entries the server rejects
 * stay listed with the reason until the user retries or discards them;
 * entries queued before queues were per-account wait for the user to
 * claim or discard them.
 */
export function OfflineSync({ userId }: { userId: string }) {
  const t = useTranslations("dashboard");
  const ts = useTranslations("status");
  const router = useRouter();
  const [queue, setQueue] = useState<QueuedEntry[]>([]);
  const [legacy, setLegacy] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(() => {
    setQueue(readQueue(userId));
    setLegacy(readLegacyQueue().length);
  }, [userId]);

  const flush = useCallback(async () => {
    if (busy.current) return;
    setQueueOwner(userId);
    const pending = readQueue(userId).filter((e) => !e.error);
    refresh();
    if (pending.length === 0 || !navigator.onLine) return;

    busy.current = true;
    setSyncing(true);
    let synced = 0;
    for (const entry of pending) {
      try {
        const res = await replay(entry);
        if (res?.error) markFailed(entry.id, res.error, userId);
        else {
          removeFromQueue(entry.id, userId);
          synced += 1;
        }
      } catch {
        break; // still offline: keep the rest for the next attempt
      }
    }
    busy.current = false;
    setSyncing(false);
    refresh();
    if (synced > 0) router.refresh();
  }, [refresh, router, userId]);

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

  const pending = queue.filter((e) => !e.error);
  const failed = queue.filter((e) => e.error);
  if (pending.length === 0 && failed.length === 0 && legacy === 0) return null;

  const btn =
    "btn-press shrink-0 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-paper-dim hover:border-flame/50 hover:text-flame";
  const label = (e: QueuedEntry) => e.fields.quick_name || t("offlineEntry");

  return (
    <div className="flex flex-col gap-2">
      {pending.length > 0 && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-flame/25 bg-flame/[0.06] px-4 py-3 text-sm text-paper-dim">
          <CloudArrowUp weight="bold" className={`size-4.5 shrink-0 text-flame ${syncing ? "animate-pulse" : ""}`} />
          <span className="min-w-0 flex-1">
            {syncing ? t("offlineSyncing", { count: pending.length }) : t("offlineQueued", { count: pending.length })}
          </span>
          {!syncing && (
            <button type="button" onClick={() => void flush()} className={btn}>
              {t("retryNow")}
            </button>
          )}
        </div>
      )}

      {failed.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-sm text-paper-dim">
          <p className="flex items-center gap-2 font-medium text-paper">
            <WarningCircle weight="bold" className="size-4.5 shrink-0 text-danger" />
            {t("offlineFailed", { count: failed.length })}
          </p>
          <ul className="flex flex-col gap-1.5">
            {failed.map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-xs">
                  <span dir="auto" className="text-paper">{label(e)}</span> · {e.fields.entry_date} ·{" "}
                  {ts(toStatusKey(e.error ?? undefined) ?? "generic")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    removeFromQueue(e.id, userId);
                    refresh();
                  }}
                  className={btn}
                >
                  {t("offlineDiscard")}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              clearFailed(userId);
              void flush();
            }}
            className={`${btn} self-start`}
          >
            {t("retryNow")}
          </button>
        </div>
      )}

      {legacy > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 px-4 py-3 text-sm text-paper-dim">
          <span className="min-w-0 flex-1">{t("offlineLegacy", { count: legacy })}</span>
          <button
            type="button"
            onClick={() => {
              adoptLegacyQueue(userId);
              void flush();
            }}
            className={btn}
          >
            {t("offlineAdopt")}
          </button>
          <button
            type="button"
            onClick={() => {
              discardLegacyQueue();
              refresh();
            }}
            className={btn}
          >
            {t("offlineDiscard")}
          </button>
        </div>
      )}
    </div>
  );
}
