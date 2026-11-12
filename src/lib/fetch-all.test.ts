import { describe, expect, it } from "vitest";
import { fetchAll } from "./fetch-all";

/** A fake table that, like PostgREST, never returns more than `cap` rows per request. */
function table(total: number, cap = 1000, failAt?: number) {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    if (failAt != null && from >= failAt) return { data: null, error: { message: "timeout" } };
    const end = Math.min(total, to + 1, from + cap);
    return { data: Array.from({ length: Math.max(0, end - from) }, (_, i) => from + i), error: null };
  };
  return { page, calls };
}

describe("fetchAll (AUD-14)", () => {
  it.each([0, 999, 1000, 1001, 2500])("returns all %i rows in order", async (n) => {
    const t = table(n);
    const rows = await fetchAll(t.page);
    expect(rows).toHaveLength(n);
    expect(rows.every((v, i) => v === i)).toBe(true);
  });

  it("asks for one extra page when the last page is exactly full", async () => {
    const t = table(1000);
    await fetchAll(t.page);
    expect(t.calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it("fails instead of returning a partial export", async () => {
    await expect(fetchAll(table(2500, 1000, 1000).page)).rejects.toThrow("timeout");
  });
});
