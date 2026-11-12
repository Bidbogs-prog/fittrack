import { describe, expect, it } from "vitest";
import { FOLD_AT, KEEP_VERBATIM, planFold, type TailMessage } from "./rolling-summary";

/** An exchange = user + assistant rows inserted together (same created_at). */
const exchange = (n: number): TailMessage[] => {
  const at = new Date(Date.UTC(2026, 10, 12, 10, n)).toISOString();
  return [
    { role: "user", content: `fact ${n}`, created_at: at },
    { role: "assistant", content: `noted ${n}`, created_at: at },
  ];
};

describe("planFold (AUD-10)", () => {
  it("doesn't fold while the tail fits", () => {
    expect(planFold(Array.from({ length: FOLD_AT / 2 }, (_, i) => exchange(i)).flat())).toBeNull();
  });

  it("folds the oldest whole exchanges and keeps the newest verbatim", () => {
    const tail = Array.from({ length: 10 }, (_, i) => exchange(i)).flat();
    const plan = planFold(tail)!;
    expect(plan.fold).toHaveLength(20 - KEEP_VERBATIM);
    expect(plan.through).toBe(tail[plan.fold.length - 1].created_at);
    expect(plan.fold.length % 2).toBe(0);
  });

  it("over a 40-exchange conversation every fact stays visible to the coach", () => {
    let summary: string[] = [];
    let tail: TailMessage[] = [];
    for (let n = 1; n <= 40; n++) {
      const visible = new Set([...summary, ...tail.filter((m) => m.role === "user").map((m) => m.content)]);
      for (let k = 1; k < n; k++) expect(visible.has(`fact ${k}`), `turn ${n} lost fact ${k}`).toBe(true);
      tail = [...tail, ...exchange(n)];
      const plan = planFold(tail);
      if (plan) {
        summary = [...summary, ...plan.fold.filter((m) => m.role === "user").map((m) => m.content)];
        tail = tail.filter((m) => m.created_at > plan.through);
      }
      expect(tail.length).toBeLessThanOrEqual(FOLD_AT);
    }
  });
});
