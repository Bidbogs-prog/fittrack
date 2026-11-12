/**
 * Offline diary queue (roadmap 2.1). Client-side only: when a log action
 * throws (network gone), the entry's form fields are stored here and
 * OfflineSync replays them through the same server actions once the
 * connection returns.
 *
 * AUD-03/04: every entry belongs to the account that queued it (one storage
 * key per user, and the owner travels with the fields so the server refuses
 * a replay into another account). Nothing is dropped silently: enqueue
 * reports whether the entry was actually stored, a full queue refuses new
 * entries instead of evicting old ones, and entries the server rejects stay
 * visible as "failed" until the user discards them. Each entry carries a
 * client_id so a replay after a lost response can't log it twice.
 */

export type QueuedKind = "food" | "quick" | "recipe" | "savedMeal";

export interface QueuedEntry {
  id: string;
  kind: QueuedKind;
  /** The exact form fields the matching server action expects (+ owner, client_id). */
  fields: Record<string, string>;
  queuedAt: string;
  owner: string;
  /** Status key from the server when a replay was rejected; the entry is kept for the user. */
  error?: string | null;
}

/** Pre-AUD-03 queue: no owner recorded, so it is never replayed automatically. */
const LEGACY_KEY = "fittrack-offline-queue";
const OWNER_KEY = "so3ra-offline-owner";
export const MAX_QUEUE = 100;

const keyFor = (owner: string) => `so3ra-offline-queue:${owner}`;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): QueuedEntry[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? (parsed as QueuedEntry[]) : [];
  } catch {
    return [];
  }
}

/** The signed-in account on this device (set by the app shell). */
export function setQueueOwner(userId: string | null): void {
  const s = storage();
  try {
    if (userId) s?.setItem(OWNER_KEY, userId);
    else s?.removeItem(OWNER_KEY);
  } catch {
    // storage unavailable: enqueue will report it
  }
}

export function queueOwner(): string | null {
  try {
    return storage()?.getItem(OWNER_KEY) ?? null;
  } catch {
    return null;
  }
}

export function readQueue(owner: string | null = queueOwner()): QueuedEntry[] {
  if (!owner) return [];
  try {
    return parse(storage()?.getItem(keyFor(owner)) ?? null).filter((e) => e.owner === owner);
  } catch {
    return [];
  }
}

function write(owner: string, queue: QueuedEntry[]): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(keyFor(owner), JSON.stringify(queue));
    return true;
  } catch {
    return false;
  }
}

/**
 * Store an entry for the current account. Returns false when it was NOT
 * stored (signed-out shell, full queue, storage blocked or out of space):
 * the caller must tell the user the meal wasn't saved.
 */
export function enqueue(kind: QueuedKind, fields: Record<string, string>): boolean {
  const owner = queueOwner();
  if (!owner) return false;
  const queue = readQueue(owner);
  if (queue.length >= MAX_QUEUE) return false;
  const id = crypto.randomUUID();
  const entry: QueuedEntry = {
    id,
    kind,
    fields: { ...fields, owner, client_id: id },
    queuedAt: new Date().toISOString(),
    owner,
  };
  if (!write(owner, [...queue, entry])) return false;
  // Read back: some browsers accept the write and drop it (private mode quotas).
  return readQueue(owner).some((e) => e.id === id);
}

export function removeFromQueue(id: string, owner: string | null = queueOwner()): void {
  if (owner) write(owner, readQueue(owner).filter((e) => e.id !== id));
}

/** Keep a rejected entry, with the reason, until the user discards it. */
export function markFailed(id: string, error: string, owner: string | null = queueOwner()): void {
  if (owner) write(owner, readQueue(owner).map((e) => (e.id === id ? { ...e, error } : e)));
}

/** Put failed entries back in line (after the user fixed the cause, or to retry). */
export function clearFailed(owner: string | null = queueOwner()): void {
  if (owner) write(owner, readQueue(owner).map((e) => ({ ...e, error: null })));
}

/** Entries queued before AUD-03, with no owner: only the user can say whose they are. */
export function readLegacyQueue(): QueuedEntry[] {
  try {
    return parse(storage()?.getItem(LEGACY_KEY) ?? null);
  } catch {
    return [];
  }
}

export function discardLegacyQueue(): void {
  try {
    storage()?.removeItem(LEGACY_KEY);
  } catch {
    // nothing to do
  }
}

/** The user confirmed the legacy entries are theirs: move them into their queue. */
export function adoptLegacyQueue(owner: string): boolean {
  const legacy = readLegacyQueue();
  if (legacy.length === 0) return true;
  const queue = readQueue(owner);
  const adopted = legacy.slice(0, Math.max(0, MAX_QUEUE - queue.length)).map((e) => ({
    ...e,
    owner,
    error: null,
    fields: { ...e.fields, owner, client_id: e.id },
  }));
  if (!write(owner, [...queue, ...adopted])) return false;
  if (adopted.length === legacy.length) discardLegacyQueue();
  else {
    try {
      storage()?.setItem(LEGACY_KEY, JSON.stringify(legacy.slice(adopted.length)));
    } catch {
      return false;
    }
  }
  return true;
}
