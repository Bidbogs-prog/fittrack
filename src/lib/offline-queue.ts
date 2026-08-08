/**
 * Offline diary queue (roadmap 2.1). Client-side only: when a log action
 * throws (network gone), the add-food dialog stores the form fields here;
 * OfflineSync flushes them through the same server actions once the
 * connection returns. localStorage keeps this dependency-free — the queue
 * is small and short-lived by nature.
 */

export type QueuedKind = "food" | "quick" | "recipe";

export interface QueuedEntry {
  id: string;
  kind: QueuedKind;
  /** The exact form fields the matching server action expects. */
  fields: Record<string, string>;
  queuedAt: string;
}

const KEY = "fittrack-offline-queue";
const MAX_QUEUE = 100;

export function readQueue(): QueuedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as QueuedEntry[]) : [];
  } catch {
    return [];
  }
}

function write(queue: QueuedEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    // Quota/private-mode failures just lose the queue — nothing to do.
  }
}

export function enqueue(kind: QueuedKind, fields: Record<string, string>): void {
  write([
    ...readQueue(),
    { id: crypto.randomUUID(), kind, fields, queuedAt: new Date().toISOString() },
  ]);
}

export function removeFromQueue(id: string): void {
  write(readQueue().filter((entry) => entry.id !== id));
}
