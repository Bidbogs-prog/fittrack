import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { coachQuotaError, featureQuotaError, getCoachAllowance } from "./ai-usage";

/**
 * Quota limits — boundary value analysis on the free/premium caps. Supabase
 * is replaced by a stub returning N usage rows (a test double); the spend
 * kill switch is disabled so only the per-user caps are under test.
 */
type Rows = { created_at: string }[];

function stub(rows: Rows, opts: { count?: number; error?: boolean } = {}) {
  const result = opts.error
    ? { data: null, count: null, error: { message: "down" } }
    : { data: rows, count: opts.count ?? rows.length, error: null };
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte"]) chain[m] = () => chain;
  (chain as { then: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  return { from: () => chain, rpc: async () => ({ data: 0, error: null }) } as never;
}

const today = (n: number): Rows =>
  Array.from({ length: n }, () => ({ created_at: new Date().toISOString() }));
const earlierThisMonth = (n: number): Rows => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 30));
  // On the 1st (UTC), "earlier this month" is still today; skip those rows' day effect.
  return Array.from({ length: n }, () => ({ created_at: d.toISOString() }));
};

const ENV = ["COACH_DAILY_MESSAGE_LIMIT", "COACH_MONTHLY_MESSAGE_LIMIT", "COACH_PREMIUM_DAILY_MESSAGE_LIMIT", "MEAL_LOG_DAILY_LIMIT", "AI_DAILY_SPEND_LIMIT_USD"];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV) saved[k] = process.env[k];
  for (const k of ENV) delete process.env[k];
  process.env.AI_DAILY_SPEND_LIMIT_USD = "0";
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] == null) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("coach — free daily cap (default 10), monthly cap disabled to isolate it", () => {
  beforeEach(() => {
    process.env.COACH_MONTHLY_MESSAGE_LIMIT = "0";
  });
  it("9 used today → allowed", async () => expect(await coachQuotaError(stub(today(9)), "u", false)).toBeNull());
  it("10 used today → dailyLimit", async () => expect(await coachQuotaError(stub(today(10)), "u", false)).toBe("dailyLimit"));
});

describe("coach — free defaults together (OBS-1 in docs/qa/defects.md)", () => {
  it("with both defaults at 10, the monthly cap is reached first and the daily cap never fires", async () => {
    expect(await coachQuotaError(stub(today(10)), "u", false)).toBe("monthlyLimit");
  });
});

describe("coach — free monthly cap (default 10)", () => {
  it("monthly reached before daily → monthlyLimit wins", async () => {
    process.env.COACH_DAILY_MESSAGE_LIMIT = "50";
    expect(await coachQuotaError(stub(today(10)), "u", false)).toBe("monthlyLimit");
  });
  it("monthly 9 of 10 → allowed", async () => {
    process.env.COACH_DAILY_MESSAGE_LIMIT = "50";
    expect(await coachQuotaError(stub(earlierThisMonth(9)), "u", false)).toBeNull();
  });
});

describe("coach — premium (50/day, no monthly cap)", () => {
  it("49 today → allowed", async () => expect(await coachQuotaError(stub(today(49)), "u", true)).toBeNull());
  it("50 today → dailyLimit", async () => expect(await coachQuotaError(stub(today(50)), "u", true)).toBe("dailyLimit"));
  it("allowance has no monthly cap", async () => {
    const a = await getCoachAllowance(stub(today(3)), "u", true);
    expect(a).toMatchObject({ premium: true, daily: 50, monthly: null, usedToday: 3 });
  });
});

describe("env overrides", () => {
  it("0 means unlimited", async () => {
    process.env.COACH_DAILY_MESSAGE_LIMIT = "0";
    process.env.COACH_MONTHLY_MESSAGE_LIMIT = "0";
    expect(await coachQuotaError(stub(today(500)), "u", false)).toBeNull();
  });
  it("custom daily limit is honoured at its boundary", async () => {
    process.env.COACH_DAILY_MESSAGE_LIMIT = "3";
    process.env.COACH_MONTHLY_MESSAGE_LIMIT = "0";
    expect(await coachQuotaError(stub(today(2)), "u", false)).toBeNull();
    expect(await coachQuotaError(stub(today(3)), "u", false)).toBe("dailyLimit");
  });
});

describe("fail-open on metering outage", () => {
  it("usage read error → allowed (known=false)", async () => {
    const s = stub([], { error: true });
    expect(await coachQuotaError(s, "u", false)).toBeNull();
    expect((await getCoachAllowance(s, "u", false)).known).toBe(false);
  });
});

describe("feature caps — meal logging (free 30 / premium 100)", () => {
  it("free 29 → allowed", async () => expect(await featureQuotaError(stub([], { count: 29 }), "u", "meal_log", false)).toBeNull());
  it("free 30 → limited", async () => expect(await featureQuotaError(stub([], { count: 30 }), "u", "meal_log", false)).toMatch(/limit/));
  it("premium 99 → allowed", async () => expect(await featureQuotaError(stub([], { count: 99 }), "u", "meal_log", true)).toBeNull());
  it("premium 100 → limited", async () => expect(await featureQuotaError(stub([], { count: 100 }), "u", "meal_log", true)).toMatch(/limit/));
  it("uncapped feature → always allowed", async () => expect(await featureQuotaError(stub([], { count: 9999 }), "u", "coach_summary", false)).toBeNull());
});
