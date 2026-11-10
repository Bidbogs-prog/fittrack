import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

/** Push reminders (migration 20260822000000): own rows only; the send log is service-only. */
let t: TestDb;
let a: string;
let b: string;

beforeAll(async () => {
  t = await createTestDb();
  a = await t.user("a@example.com");
  b = await t.user("b@example.com");
}, 60_000);

describe("push reminders RLS", () => {
  it("a user saves their own subscription and settings with defaults", async () => {
    await t.as(a, () =>
      t.rows("insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/a', 'k', 'x')")
    );
    await t.as(a, () => t.rows("insert into public.reminder_settings (timezone) values ('Africa/Casablanca')"));
    const [s] = await t.as(a, () => t.rows<{ lunch: string; locale: string }>("select lunch, locale from public.reminder_settings"));
    expect(s).toMatchObject({ lunch: "13:30:00", locale: "en" });
  });

  it("other users can't see or delete them", async () => {
    expect(await t.as(b, () => t.rows("select 1 from public.push_subscriptions"))).toHaveLength(0);
    await t.as(b, () => t.rows("delete from public.push_subscriptions"));
    expect(await t.admin(() => t.rows("select 1 from public.push_subscriptions where user_id = $1", [a]))).toHaveLength(1);
  });

  it("subscriptions must be https endpoints", async () => {
    await expect(
      t.as(b, () => t.rows("insert into public.push_subscriptions (endpoint, p256dh, auth) values ('http://evil', 'k', 'x')"))
    ).rejects.toThrow(/check constraint/);
  });

  it("users can't read or write the send log (no reminder spoofing or reset)", async () => {
    await expect(
      t.as(a, () => t.rows("insert into public.reminder_log (user_id, slot, local_date) values ($1, 'lunch', current_date)", [a]))
    ).rejects.toThrow(/row-level security/);
    expect(await t.as(a, () => t.rows("select 1 from public.reminder_log"))).toHaveLength(0);
  });

  it("reminder_candidates resolves local time in Postgres and is service-only", async () => {
    await t.admin(() => t.rows("update public.reminder_settings set timezone = 'Not/AZone' where user_id = $1", [a]));
    const rows = await t.admin(() =>
      t.rows<{ timezone: string; local_minutes: number }>("select timezone, local_minutes from public.reminder_candidates()")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].local_minutes).toBeGreaterThanOrEqual(0);
    await expect(t.as(a, () => t.rows("select * from public.reminder_candidates()"))).rejects.toThrow(/permission denied/);
  });

  it("the send log dedupes one slot per user per local day", async () => {
    await t.admin(() => t.rows("insert into public.reminder_log (user_id, slot, local_date) values ($1, 'lunch', '2026-11-02')", [a]));
    await expect(
      t.admin(() => t.rows("insert into public.reminder_log (user_id, slot, local_date) values ($1, 'lunch', '2026-11-02')", [a]))
    ).rejects.toThrow(/duplicate key/);
  });
});
