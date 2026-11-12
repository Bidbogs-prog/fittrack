import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The service-role client: reservations and spend checks (AUD-09). */
const admin = vi.hoisted(() => ({
  enabled: true,
  reserve: "ok" as string | { error: string },
  spend: 0 as number | { error: string },
  calls: [] as { fn: string; args: Record<string, unknown> }[],
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () =>
    admin.enabled
      ? {
          rpc: async (fn: string, args: Record<string, unknown>) => {
            admin.calls.push({ fn, args });
            const v = fn === "reserve_ai_call" ? admin.reserve : fn === "ai_spend_today" ? admin.spend : null;
            return typeof v === "object" && v != null ? { data: null, error: { message: v.error } } : { data: v, error: null };
          },
        }
      : null,
}));

import { aiSpendExceeded, coachQuotaError, featureQuotaError, getCoachAllowance } from "./ai-usage";

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

const ENV = ["COACH_DAILY_MESSAGE_LIMIT", "COACH_MONTHLY_MESSAGE_LIMIT", "COACH_PREMIUM_DAILY_MESSAGE_LIMIT", "MEAL_LOG_DAILY_LIMIT", "AI_DAILY_SPEND_LIMIT_USD", "BETA_INVITE_ONLY"];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  admin.enabled = true;
  admin.reserve = "ok";
  admin.spend = 0;
  admin.calls = [];
  for (const k of ENV) saved[k] = process.env[k];
  for (const k of ENV) delete process.env[k];
  process.env.AI_DAILY_SPEND_LIMIT_USD = "0";
  // Caps under test in isolation; the beta gate has its own block below.
  process.env.BETA_INVITE_ONLY = "0";
});

describe("beta gate on AI endpoints (audit #5)", () => {
  /** No beta_access row, waitlist claim refused. */
  const outsider = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte"]) chain[m] = () => chain;
    chain.maybeSingle = async () => ({ data: null, error: null });
    return { from: () => chain, rpc: async () => ({ data: false, error: null }) } as never;
  };
  beforeEach(() => {
    process.env.BETA_INVITE_ONLY = "1";
  });
  it("coach refuses an account without beta access", async () => {
    expect(await coachQuotaError(outsider(), "outsider-1", false)).toBe("invite");
  });
  it("other AI features refuse an account without beta access", async () => {
    expect(await featureQuotaError(outsider(), "outsider-2", "meal_log", false)).toMatch(/beta access/);
  });
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] == null) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const reserveArgs = () => admin.calls.filter((c) => c.fn === "reserve_ai_call").map((c) => c.args);
const noRows = stub([]);

describe("coach caps are reserved atomically (AUD-09)", () => {
  it("free defaults: 5 a day, 10 a month", async () => {
    expect(await coachQuotaError(noRows, "u", false)).toBeNull();
    expect(reserveArgs()).toEqual([{ p_user: "u", p_feature: "coach", p_daily: 5, p_monthly: 10 }]);
  });
  it("premium: 50 a day, no monthly cap", async () => {
    await coachQuotaError(noRows, "u", true);
    expect(reserveArgs()[0]).toMatchObject({ p_daily: 50, p_monthly: null });
  });
  it("maps the cap that was hit", async () => {
    admin.reserve = "daily";
    expect(await coachQuotaError(noRows, "u", false)).toBe("dailyLimit");
    admin.reserve = "monthly";
    expect(await coachQuotaError(noRows, "u", false)).toBe("monthlyLimit");
  });
  it("fails closed when the reservation can't be made", async () => {
    admin.reserve = { error: "db down" };
    expect(await coachQuotaError(noRows, "u", false)).toBe("unavailable");
    admin.enabled = false;
    expect(await coachQuotaError(noRows, "u", false)).toBe("unavailable");
  });
  it("0 means unlimited: no reservation at all", async () => {
    process.env.COACH_DAILY_MESSAGE_LIMIT = "0";
    process.env.COACH_MONTHLY_MESSAGE_LIMIT = "0";
    expect(await coachQuotaError(noRows, "u", false)).toBeNull();
    expect(reserveArgs()).toEqual([]);
  });
  it("custom limits reach the reservation", async () => {
    process.env.COACH_DAILY_MESSAGE_LIMIT = "3";
    await coachQuotaError(noRows, "u", false);
    expect(reserveArgs()[0]).toMatchObject({ p_daily: 3 });
  });
});

describe("feature caps — meal logging (free 30 / premium 100)", () => {
  it("passes the free and premium caps", async () => {
    await featureQuotaError(noRows, "u", "meal_log", false);
    await featureQuotaError(noRows, "u", "meal_log", true);
    expect(reserveArgs()).toEqual([
      { p_user: "u", p_feature: "meal_log", p_daily: 30, p_monthly: null },
      { p_user: "u", p_feature: "meal_log", p_daily: 100, p_monthly: null },
    ]);
  });
  it("cap hit → the feature's message", async () => {
    admin.reserve = "daily";
    expect(await featureQuotaError(noRows, "u", "meal_log", false)).toMatch(/AI logging limit/);
  });
  it("reservation failure → unavailable, not allowed", async () => {
    admin.reserve = { error: "db down" };
    expect(await featureQuotaError(noRows, "u", "meal_log", false)).toMatch(/temporarily unavailable/);
  });
  it("uncapped feature → allowed without a reservation", async () => {
    expect(await featureQuotaError(noRows, "u", "coach_summary", false)).toBeNull();
    expect(reserveArgs()).toEqual([]);
  });
});

describe("spend cap fails closed (AUD-09)", () => {
  beforeEach(() => {
    process.env.AI_DAILY_SPEND_LIMIT_USD = "5";
  });
  it("missing service key pauses AI", async () => {
    admin.enabled = false;
    expect(await aiSpendExceeded(noRows)).toBe(true);
  });
  it("a failed spend read pauses AI", async () => {
    admin.spend = { error: "timeout" };
    expect(await aiSpendExceeded(noRows)).toBe(true);
  });
});

describe("allowance display", () => {
  it("premium has no monthly cap", async () => {
    const a = await getCoachAllowance(stub(today(3)), "u", true);
    expect(a).toMatchObject({ premium: true, daily: 50, monthly: null, usedToday: 3 });
  });
});
