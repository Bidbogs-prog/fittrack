import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_QUEUE,
  adoptLegacyQueue,
  enqueue,
  markFailed,
  readLegacyQueue,
  readQueue,
  setQueueOwner,
} from "./offline-queue";

let data: Map<string, string>;
function memoryStorage(fail = false) {
  data = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (fail && k !== "so3ra-offline-owner") throw new Error("QuotaExceededError");
        data.set(k, v);
      },
      removeItem: (k: string) => data.delete(k),
    },
  });
}

beforeEach(() => memoryStorage());
afterEach(() => vi.unstubAllGlobals());

describe("offline queue is per account (AUD-03)", () => {
  it("B never sees or replays A's entries", () => {
    setQueueOwner("user-a");
    expect(enqueue("quick", { quick_name: "A's meal", quick_kcal: "100" })).toBe(true);
    setQueueOwner("user-b");
    expect(readQueue()).toEqual([]);
    setQueueOwner("user-a");
    const [entry] = readQueue();
    expect(entry.owner).toBe("user-a");
    // The owner and an idempotency key travel to the server with the fields.
    expect(entry.fields).toMatchObject({ owner: "user-a", client_id: entry.id });
  });

  it("nothing is queued without a signed-in owner", () => {
    setQueueOwner(null);
    expect(enqueue("quick", { quick_name: "x" })).toBe(false);
  });

  it("legacy entries without an owner wait for the user to claim them", () => {
    data.set("fittrack-offline-queue", JSON.stringify([{ id: "old-1", kind: "quick", fields: { quick_name: "old" }, queuedAt: "2026-01-01" }]));
    setQueueOwner("user-b");
    expect(readQueue()).toEqual([]);
    expect(readLegacyQueue()).toHaveLength(1);
    expect(adoptLegacyQueue("user-b")).toBe(true);
    expect(readQueue()[0]).toMatchObject({ owner: "user-b", fields: { owner: "user-b", client_id: "old-1" } });
    expect(readLegacyQueue()).toEqual([]);
  });
});

describe("offline queue never loses entries silently (AUD-04)", () => {
  it("reports a storage failure instead of pretending it saved", () => {
    memoryStorage(true);
    setQueueOwner("user-a");
    expect(enqueue("quick", { quick_name: "Lost meal" })).toBe(false);
  });

  it("a full queue refuses the next entry and keeps the oldest", () => {
    setQueueOwner("user-a");
    for (let n = 0; n < MAX_QUEUE; n++) expect(enqueue("quick", { quick_name: String(n) })).toBe(true);
    expect(enqueue("quick", { quick_name: "overflow" })).toBe(false);
    expect(readQueue()).toHaveLength(MAX_QUEUE);
    expect(readQueue()[0].fields.quick_name).toBe("0");
  });

  it("a rejected replay stays in the queue with its reason", () => {
    setQueueOwner("user-a");
    enqueue("food", { food_id: "f", grams: "0" });
    const [entry] = readQueue();
    markFailed(entry.id, "gramsRange");
    expect(readQueue()).toEqual([expect.objectContaining({ id: entry.id, error: "gramsRange" })]);
  });
});
