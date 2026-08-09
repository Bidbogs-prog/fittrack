import { describe, expect, it } from "vitest";
import { calcStreaks } from "./streak";

const TODAY = "2026-08-09";

describe("calcStreaks", () => {
  it("counts consecutive days ending today", () => {
    const { current } = calcStreaks(["2026-08-07", "2026-08-08", "2026-08-09"], TODAY);
    expect(current).toBe(3);
  });

  it("an empty today does not break yesterday's run", () => {
    const { current } = calcStreaks(["2026-08-07", "2026-08-08"], TODAY);
    expect(current).toBe(2);
  });

  it("a gap resets the streak", () => {
    const { current } = calcStreaks(["2026-08-05", "2026-08-06", "2026-08-08", "2026-08-09"], TODAY);
    expect(current).toBe(2);
  });

  it("no recent days means zero", () => {
    expect(calcStreaks(["2026-08-01"], TODAY).current).toBe(0);
    expect(calcStreaks([], TODAY).current).toBe(0);
  });

  it("consistency is the share of the last 30 days logged", () => {
    const fifteen = Array.from({ length: 15 }, (_, i) => {
      const d = new Date("2026-08-09T12:00:00");
      d.setDate(d.getDate() - i * 2); // every other day
      return d.toLocaleDateString("en-CA");
    });
    expect(calcStreaks(fifteen, TODAY).consistency30).toBe(50);
  });
});
