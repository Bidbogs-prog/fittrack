import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

/**
 * Coach plan requests v2 (migration 20260820000000): drafts built for a
 * request are admin-only until sent; then only the requester sees them.
 * Mirrors startPlanForRequest → sendPlanForRequest at the database level.
 */
let t: TestDb;
let admin: string;
let requester: string;
let other: string;
let planId: string;
let requestId: string;

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.user("coach@example.com");
  requester = await t.user("client@example.com");
  other = await t.user("other@example.com");
  await t.admin(() => t.rows("insert into public.admins (user_id) values ($1)", [admin]));

  [{ id: requestId }] = await t.as(requester, () =>
    t.rows<{ id: string }>(
      `insert into public.plan_requests (email, full_name, goal, note, snapshot)
       values ('client@example.com', 'Client', 'lose', 'no fish', '{"version":1,"targets":{"kcal":2000}}')
       returning id`
    )
  );
  [{ id: planId }] = await t.as(admin, () =>
    t.rows<{ id: string }>("insert into public.meal_plans (name, goal, draft) values ('Plan for Client', 'lose', true) returning id")
  );
  await t.as(admin, () => t.rows("update public.plan_requests set plan_id = $1 where id = $2", [planId, requestId]));
}, 60_000);

const sees = (user: string) =>
  t.as(user, async () => (await t.rows("select 1 from public.meal_plans where id = $1", [planId])).length === 1);

describe("brief", () => {
  it("the admin can read the requester's snapshot", async () => {
    const [row] = await t.as(admin, () =>
      t.rows<{ snapshot: { targets: { kcal: number } } }>("select snapshot from public.plan_requests where id = $1", [requestId])
    );
    expect(row.snapshot.targets.kcal).toBe(2000);
  });
  it("other users can't read someone else's request", async () => {
    expect(await t.as(other, () => t.rows("select 1 from public.plan_requests where id = $1", [requestId]))).toHaveLength(0);
  });
});

describe("admin read access to requesters (20260821000000)", () => {
  it("admin reads a pending requester's profile and diary; not other users'", async () => {
    await t.admin(() =>
      t.rows("insert into public.diary_entries (user_id, entry_date, meal, quick_name, quick_kcal) values ($1, current_date, 'lunch', 'Tagine', 600), ($2, current_date, 'lunch', 'Secret', 500)", [requester, other])
    );
    const profiles = await t.as(admin, () => t.rows<{ id: string }>("select id from public.profiles where id in ($1, $2)", [requester, other]));
    expect(profiles.map((p) => p.id)).toEqual([requester]);
    const diary = await t.as(admin, () => t.rows<{ quick_name: string }>("select quick_name from public.diary_entries where user_id in ($1, $2)", [requester, other]));
    expect(diary.map((d) => d.quick_name)).toEqual(["Tagine"]);
  });
  it("non-admins get nothing extra", async () => {
    expect(await t.as(other, () => t.rows("select 1 from public.profiles where id = $1", [requester]))).toHaveLength(0);
  });
});

describe("draft visibility", () => {
  it("while drafting: admin sees it, requester and others don't", async () => {
    expect(await sees(admin)).toBe(true);
    expect(await sees(requester)).toBe(false);
    expect(await sees(other)).toBe(false);
  });

  it("draft items are hidden too", async () => {
    const [{ id: foodId }] = await t.admin(() =>
      t.rows<{ id: string }>(
        "insert into public.foods (name, kcal, protein_g, carbs_g, fat_g) values ('Lentils', 116, 9, 20, 0.4) returning id"
      )
    );
    await t.as(admin, () =>
      t.rows("insert into public.meal_plan_items (plan_id, food_id, meal, grams) values ($1, $2, 'lunch', 200)", [planId, foodId])
    );
    const visible = (u: string) =>
      t.as(u, async () => (await t.rows("select 1 from public.meal_plan_items where plan_id = $1", [planId])).length);
    expect(await visible(admin)).toBe(1);
    expect(await visible(requester)).toBe(0);
  });

  it("after send: requester sees it, others still don't", async () => {
    await t.as(admin, () => t.rows("update public.meal_plans set draft = false, assigned_to = $1 where id = $2", [requester, planId]));
    await t.as(admin, () => t.rows("update public.plan_requests set status = 'fulfilled' where id = $1", [requestId]));
    expect(await sees(requester)).toBe(true);
    expect(await sees(other)).toBe(false);
  });

  it("once fulfilled, the admin loses read access to the requester's data", async () => {
    expect(await t.as(admin, () => t.rows("select 1 from public.profiles where id = $1", [requester]))).toHaveLength(0);
  });

  it("a requester can't flip their own request to fulfilled", async () => {
    const [{ id }] = await t.as(other, () =>
      t.rows<{ id: string }>("insert into public.plan_requests (email) values ('other@example.com') returning id")
    );
    await t.as(other, () => t.rows("update public.plan_requests set status = 'fulfilled' where id = $1", [id]));
    const [row] = await t.admin(() => t.rows<{ status: string }>("select status from public.plan_requests where id = $1", [id]));
    expect(row.status).toBe("pending");
  });
});
