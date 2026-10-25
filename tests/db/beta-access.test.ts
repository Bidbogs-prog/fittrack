import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

/**
 * Beta access — state transition tests ST-1…ST-8 (docs/qa/test-design.md §7)
 * executed against the real SQL functions: redeem_invite,
 * claim_waitlist_access, admit_waitlist and join_waitlist.
 */
let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
}, 60_000);

const code = (c: string, maxUses = 1, premiumDays = 90, expires: string | null = null) =>
  t.admin(() =>
    t.rows("insert into public.invite_codes (code, max_uses, premium_days, expires_at) values ($1, $2, $3, $4)", [c, maxUses, premiumDays, expires])
  );
const redeem = (user: string, c: string) =>
  t.as(user, async () => (await t.rows<{ r: string }>("select public.redeem_invite($1, null) as r", [c]))[0].r);
const hasAccess = async (user: string) =>
  (await t.admin(() => t.rows("select 1 from public.beta_access where user_id = $1", [user]))).length === 1;
const premiumEnd = async (user: string) =>
  (await t.admin(() => t.rows<{ end: Date | null }>("select current_period_end as end from public.entitlements where user_id = $1 and status = 'active'", [user])))[0]?.end;
const uses = async (c: string) =>
  (await t.admin(() => t.rows<{ uses: number }>("select uses from public.invite_codes where code = $1", [c])))[0].uses;

describe("invite codes", () => {
  it("ST-1 valid code → access, use counted, premium for N days", async () => {
    const u = await t.user("u1@example.com");
    await code("FAMILY", 5, 30);
    expect(await redeem(u, "family")).toBe("ok"); // case-insensitive
    expect(await hasAccess(u)).toBe(true);
    expect(await uses("FAMILY")).toBe(1);
    const days = ((await premiumEnd(u))!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it("ST-2/ST-3 last use fills the code; the next redeem is rejected", async () => {
    const [u1, u2] = [await t.user("a@example.com"), await t.user("b@example.com")];
    await code("ONE-1", 1);
    expect(await redeem(u1, "ONE-1")).toBe("ok");
    expect(await redeem(u2, "ONE-1")).toBe("full");
    expect(await hasAccess(u2)).toBe(false);
    expect(await uses("ONE-1")).toBe(1);
  });

  it("ST-4 expired code is rejected", async () => {
    const u = await t.user("u@example.com");
    await code("OLD-1", 10, 90, new Date(Date.now() - 1000).toISOString());
    expect(await redeem(u, "OLD-1")).toBe("expired");
    expect(await hasAccess(u)).toBe(false);
  });

  it("ST-5 re-redeeming the same code doesn't consume a use (now used, DR-012)", async () => {
    const u = await t.user("u@example.com");
    await code("TWO-2", 2);
    await redeem(u, "TWO-2");
    expect(await redeem(u, "TWO-2")).toBe("used");
    expect(await uses("TWO-2")).toBe(1);
  });

  it.each([
    ["ABC", false],
    ["ABCD", true],
    ["A".repeat(32), true],
    ["A".repeat(33), false],
    ["has space", false],
    ["lower-case", false],
  ])("code format boundary: %s → valid=%s", async (c, valid) => {
    const insert = code(c);
    if (valid) await expect(insert).resolves.toBeDefined();
    else await expect(insert).rejects.toThrow(/invite_codes_code_check/);
  });

  it("unknown code → invalid; signed-out → auth", async () => {
    const u = await t.user("u@example.com");
    expect(await redeem(u, "NOPE")).toBe("invalid");
    expect(await t.as(null, async () => (await t.rows<{ r: string }>("select public.redeem_invite('X', null) as r"))[0]?.r).catch(() => "denied")).toBe("denied");
  });

  it("ST-8 a shorter code never shortens a longer premium grant", async () => {
    const u = await t.user("u@example.com");
    await t.admin(() =>
      t.rows("insert into public.entitlements (user_id, source, current_period_end) values ($1, 'manual', now() + interval '365 days')", [u])
    );
    await code("SHORT", 1, 7);
    expect(await redeem(u, "SHORT")).toBe("ok");
    const days = ((await premiumEnd(u))!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(360);
  });

  it("ST-8b a code never shortens an open-ended (manual) grant", async () => {
    const u = await t.user("u@example.com");
    await t.admin(() => t.rows("insert into public.entitlements (user_id, source) values ($1, 'manual')", [u]));
    await code("SHORT", 1, 7);
    await redeem(u, "SHORT");
    expect(await premiumEnd(u)).toBeNull();
  });
});

describe("waitlist", () => {
  const join = (email: string, ref: string | null = null) =>
    t.as(null, async () =>
      (await t.rows<{ referral_code: string; queue_position: number; already: boolean }>(
        "select * from public.join_waitlist($1, 'fr', 'Rabat', 'android', null, $2, null)",
        [email, ref]
      ))[0]
    );

  it("joining twice returns the same entry (already)", async () => {
    const first = await join("Sara@Example.com");
    const again = await join("sara@example.com");
    expect(again.already).toBe(true);
    expect(again.referral_code).toBe(first.referral_code);
  });

  it("rejects malformed emails", async () => {
    await expect(join("not-an-email")).rejects.toThrow(/invalid_email/);
  });

  it("referrals move the referrer up the queue", async () => {
    await join("early@example.com");
    const late = await join("late@example.com");
    expect(late.queue_position).toBe(2);
    await join("friend@example.com", late.referral_code);
    const again = await join("late@example.com");
    expect(again.queue_position).toBe(1);
  });

  it("only admins can admit; admission follows queue order", async () => {
    const admin = await t.user("admin@example.com");
    const user = await t.user("someone@example.com");
    await t.admin(() => t.rows("insert into public.admins (user_id) values ($1)", [admin]));
    await join("w1@example.com");
    const w2 = await join("w2@example.com");
    await join("ref@example.com", w2.referral_code);

    await expect(t.as(user, () => t.rows("select public.admit_waitlist(1)"))).rejects.toThrow(/not_admin/);
    const [{ n }] = await t.as(admin, () => t.rows<{ n: number }>("select public.admit_waitlist(1) as n"));
    expect(n).toBe(1);
    const admitted = await t.admin(() => t.rows<{ email: string }>("select email from public.waitlist where status = 'admitted'"));
    expect(admitted.map((r) => r.email)).toEqual(["w2@example.com"]);
  });

  it("ST-6 admitted email gets access on sign-up; ST-7 waiting email does not", async () => {
    const admin = await t.user("admin@example.com");
    await t.admin(() => t.rows("insert into public.admins (user_id) values ($1)", [admin]));
    await join("in@example.com");
    await t.as(admin, () => t.rows("select public.admit_waitlist(1)"));
    await join("out@example.com");

    const inUser = await t.user("in@example.com");
    const outUser = await t.user("out@example.com");
    const claim = (u: string) => t.as(u, async () => (await t.rows<{ ok: boolean }>("select public.claim_waitlist_access(null) as ok"))[0].ok);

    expect(await claim(inUser)).toBe(true);
    expect(await hasAccess(inUser)).toBe(true);
    expect(await premiumEnd(inUser)).not.toBeUndefined();
    const [row] = await t.admin(() => t.rows<{ status: string }>("select status from public.waitlist where email = 'in@example.com'"));
    expect(row.status).toBe("joined");

    expect(await claim(outUser)).toBe(false);
    expect(await hasAccess(outUser)).toBe(false);
  });

  it("an unconfirmed email cannot claim an admitted spot", async () => {
    const admin = await t.user("admin@example.com");
    await t.admin(() => t.rows("insert into public.admins (user_id) values ($1)", [admin]));
    await join("victim@example.com");
    await t.as(admin, () => t.rows("select public.admit_waitlist(1)"));
    const squatter = await t.user("victim@example.com");
    await t.admin(() => t.rows("update auth.users set email_confirmed_at = null where id = $1", [squatter]));
    expect(await t.as(squatter, async () => (await t.rows<{ ok: boolean }>("select public.claim_waitlist_access(null) as ok"))[0].ok)).toBe(false);
  });
});

/**
 * DR-012 — existing members (grandfathered or admitted via the waitlist)
 * redeeming a code must get its premium days, once per code.
 */
describe("invite codes for existing members (DR-012)", () => {
  const member = async (email: string) => {
    const u = await t.user(email);
    await t.admin(() => t.rows("insert into public.beta_access (user_id, via) values ($1, 'grandfathered')", [u]));
    return u;
  };

  it("grants the code's premium days to a member who had none", async () => {
    const u = await member("amina@example.com");
    await code("PROMO-30", 10, 30);
    expect(await redeem(u, "PROMO-30")).toBe("premium");
    const days = ((await premiumEnd(u))!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(await uses("PROMO-30")).toBe(1);
  });

  it("the same member can't redeem the same code twice", async () => {
    const u = await member("twice@example.com");
    await code("PROMO-2X", 10, 30);
    await redeem(u, "PROMO-2X");
    expect(await redeem(u, "PROMO-2X")).toBe("used");
    expect(await uses("PROMO-2X")).toBe(1);
  });

  it("a code with 0 premium days doesn't burn a use for a member", async () => {
    const u = await member("zero@example.com");
    await code("ACCESS-ONLY", 10, 0);
    expect(await redeem(u, "ACCESS-ONLY")).toBe("already");
    expect(await uses("ACCESS-ONLY")).toBe(0);
  });

  it("full and expired codes are still rejected for members", async () => {
    const [u1, u2] = [await member("m1@example.com"), await member("m2@example.com")];
    await code("ONE-SPOT", 1, 30);
    await code("STALE-1", 10, 30, new Date(Date.now() - 1000).toISOString());
    expect(await redeem(u1, "ONE-SPOT")).toBe("premium");
    expect(await redeem(u2, "ONE-SPOT")).toBe("full");
    expect(await redeem(u2, "STALE-1")).toBe("expired");
  });

  it("a new user who redeemed at the gate can't reuse the code later for more premium", async () => {
    const u = await t.user("gate@example.com");
    await code("GATE-1", 10, 30);
    expect(await redeem(u, "GATE-1")).toBe("ok");
    expect(await redeem(u, "GATE-1")).toBe("used");
    expect(await uses("GATE-1")).toBe(1);
  });
});
