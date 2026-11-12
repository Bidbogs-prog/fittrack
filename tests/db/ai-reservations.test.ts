import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

/**
 * AI caps as reservations (migration 20260903000000, AUD-09). Boundary
 * values on the daily and monthly caps, in-flight reservations counted,
 * abandoned ones expiring, and usage filling the reservation.
 */
let t: TestDb;
let u: string;
let n = 0;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

const fresh = async () => (u = await t.user(`res${++n}@example.com`));
const reserve = (feature: string, daily: number | null, monthly: number | null) =>
  t.admin(async () => (await t.rows<{ r: string }>("select public.reserve_ai_call($1, $2, $3, $4) as r", [u, feature, daily, monthly]))[0].r);
const record = (feature: string, cost = 0.01) =>
  t.admin(() => t.rows("select public.record_ai_usage($1, $2, 'llmgateway', 'm', 10, 0, 5, $3)", [u, feature, cost]));
const rows = (feature: string) =>
  t.admin(() => t.rows<{ status: string; cost_usd: string | null }>("select status, cost_usd from public.ai_usage where user_id = $1 and feature = $2 order by id", [u, feature]));

describe("reserve_ai_call", () => {
  it("allows exactly the daily cap, counting in-flight reservations", async () => {
    await fresh();
    for (let i = 0; i < 3; i++) expect(await reserve("meal_log", 3, null)).toBe("ok");
    // 3 reserved, none finished yet: a 4th parallel request is refused.
    expect(await reserve("meal_log", 3, null)).toBe("daily");
  });

  it("monthly cap wins when both are hit, and is checked over the month", async () => {
    await fresh();
    await t.admin(() =>
      t.rows("insert into public.ai_usage (user_id, feature, provider, model, created_at) select $1, 'coach', 'p', 'm', (date_trunc('month', now() at time zone 'utc') at time zone 'utc') + interval '1 minute' from generate_series(1, 9)", [u])
    );
    expect(await reserve("coach", 50, 10)).toBe("ok"); // 9 done + this one = 10
    expect(await reserve("coach", 50, 10)).toBe("monthly");
  });

  it("an abandoned reservation stops counting after 10 minutes", async () => {
    await fresh();
    expect(await reserve("voice", 1, null)).toBe("ok");
    expect(await reserve("voice", 1, null)).toBe("daily");
    await t.admin(() => t.rows("update public.ai_usage set created_at = now() - interval '11 minutes' where user_id = $1", [u]));
    // Unless that pushes it back to yesterday (test run just after UTC midnight).
    const [{ today }] = await t.admin(() => t.rows<{ today: boolean }>("select now() - interval '11 minutes' >= date_trunc('day', now()) as today"));
    if (today) expect(await reserve("voice", 1, null)).toBe("ok");
  });

  it("other features and users have their own counts", async () => {
    await fresh();
    expect(await reserve("week_report", 1, null)).toBe("ok");
    expect(await reserve("day_insights", 1, null)).toBe("ok");
    await fresh();
    expect(await reserve("week_report", 1, null)).toBe("ok");
  });

  it("only the service role can reserve or record", async () => {
    await fresh();
    await expect(t.as(u, () => t.rows("select public.reserve_ai_call($1, 'coach', null, null)", [u]))).rejects.toThrow(/permission denied/);
    await expect(t.as(u, () => t.rows("select public.record_ai_usage($1, 'coach', 'p', 'm', 0, 0, 0, 999)", [u]))).rejects.toThrow(/permission denied/);
  });
});

describe("record_ai_usage", () => {
  it("fills the open reservation instead of adding a second row", async () => {
    await fresh();
    await reserve("meal_log", 5, null);
    await record("meal_log", 0.02);
    expect(await rows("meal_log")).toEqual([{ status: "done", cost_usd: "0.020000" }]);
  });

  it("adds a row for uncapped features (no reservation)", async () => {
    await fresh();
    await record("coach_summary");
    expect(await rows("coach_summary")).toEqual([{ status: "done", cost_usd: "0.010000" }]);
  });
});
