import { beforeAll, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

/** Offline replays (migration 20260901000000): one diary row per client_id per user. */
let t: TestDb;
let a: string;
let b: string;
beforeAll(async () => {
  t = await createTestDb();
  a = await t.user("a@example.com");
  b = await t.user("b@example.com");
}, 60_000);

const quick = (who: string, clientId: string | null) =>
  t.as(who, () =>
    t.rows("insert into public.diary_entries (user_id, meal, entry_date, quick_name, quick_kcal, client_id) values ($1, 'lunch', '2026-11-12', 'Harira', 250, $2)", [who, clientId])
  );

it("a replayed entry with the same client_id is rejected as a duplicate (AUD-04)", async () => {
  await quick(a, "6f1c2a1e-0000-4000-8000-000000000001");
  await expect(quick(a, "6f1c2a1e-0000-4000-8000-000000000001")).rejects.toThrow(/duplicate key/);
});

it("client_ids are per user, and entries without one are unaffected", async () => {
  await quick(b, "6f1c2a1e-0000-4000-8000-000000000001");
  await quick(a, null);
  await quick(a, null);
  const rows = await t.as(a, () => t.rows("select 1 from public.diary_entries where client_id is null"));
  expect(rows).toHaveLength(2);
});
