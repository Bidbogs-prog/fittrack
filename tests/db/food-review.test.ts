import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

/**
 * Food review (migration 20260831000000): users' foods stay private while
 * pending; only admins approve (owner_id → null = shared) or reject.
 */
let t: TestDb;
let admin: string;
let user: string;
let other: string;

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.user("admin@example.com");
  user = await t.user("user@example.com");
  other = await t.user("other@example.com");
  await t.admin(() => t.rows("insert into public.admins (user_id) values ($1)", [admin]));
}, 60_000);

const FOOD = "name, category, kcal, protein_g, carbs_g, fat_g";
const VALS = "'Harcha', 'carbs', 400, 8, 60, 14";
const insertOwn = (who: string, extra = "", extraVals = "") =>
  t.as(who, () =>
    t.rows<{ id: string }>(
      `insert into public.foods (${FOOD}, owner_id${extra}) values (${VALS}, $1${extraVals}) returning id`,
      [who]
    )
  );
const visible = (who: string, id: string) =>
  t.as(who, async () => (await t.rows("select 1 from public.foods where id = $1", [id])).length === 1);

describe("food review queue", () => {
  it("a pending food is visible to its owner and admins, not to other users", async () => {
    const [{ id }] = await insertOwn(user, ", review_status", ", 'pending'");
    expect(await visible(user, id)).toBe(true);
    expect(await visible(admin, id)).toBe(true);
    expect(await visible(other, id)).toBe(false);
  });

  it("users can't share their own food or mark it rejected", async () => {
    await expect(t.as(user, () => t.rows(`insert into public.foods (${FOOD}) values (${VALS})`))).rejects.toThrow(/row-level security/);
    // A self-set 'rejected' is overridden to 'pending' (AUD-05 trigger).
    const [self] = await t.as(user, () =>
      t.rows<{ review_status: string }>(`insert into public.foods (${FOOD}, owner_id, review_status) values (${VALS}, $1, 'rejected') returning review_status`, [user])
    );
    expect(self.review_status).toBe("pending");
    const [{ id }] = await insertOwn(user, ", review_status", ", 'pending'");
    await expect(t.as(user, () => t.rows("update public.foods set owner_id = null where id = $1", [id]))).rejects.toThrow(/row-level security/);
    const [kept] = await t.as(user, () =>
      t.rows<{ review_status: string }>("update public.foods set review_status = 'rejected' where id = $1 returning review_status", [id])
    );
    expect(kept.review_status).toBe("pending");
  });

  it("approval shares the food with everyone", async () => {
    const [{ id }] = await insertOwn(user, ", review_status", ", 'pending'");
    await t.as(admin, () =>
      t.rows("update public.foods set owner_id = null, review_status = null, reviewed_by = $2, reviewed_at = now() where id = $1", [id, admin])
    );
    expect(await visible(other, id)).toBe(true);
  });

  it("a rejected food stays private and can be resubmitted by editing", async () => {
    const [{ id }] = await insertOwn(user, ", review_status", ", 'pending'");
    await t.as(admin, () => t.rows("update public.foods set review_status = 'rejected' where id = $1", [id]));
    expect(await visible(other, id)).toBe(false);
    await t.as(user, () => t.rows("update public.foods set kcal = 380, review_status = 'pending' where id = $1", [id]));
    const [row] = await t.as(user, () => t.rows<{ review_status: string }>("select review_status from public.foods where id = $1", [id]));
    expect(row.review_status).toBe("pending");
  });

  it("a shared food can't carry a review status", async () => {
    await expect(
      t.as(admin, () => t.rows(`insert into public.foods (${FOOD}, review_status) values (${VALS}, 'pending')`))
    ).rejects.toThrow(/foods_review_private/);
  });
});

describe("review is enforced by the database (AUD-05)", () => {
  it("a direct insert without a status still lands in the queue", async () => {
    const [f] = await t.as(user, () =>
      t.rows<{ review_status: string | null }>(`insert into public.foods (${FOOD}, owner_id) values (${VALS}, $1) returning review_status`, [user])
    );
    expect(f.review_status).toBe("pending");
  });

  it("users can't write reviewer fields or clear the status", async () => {
    const [{ id }] = await insertOwn(user);
    const [row] = await t.as(user, () =>
      t.rows<{ review_status: string; reviewed_by: string | null }>(
        "update public.foods set reviewed_by = $2, reviewed_at = now(), review_status = null where id = $1 returning review_status, reviewed_by",
        [id, other]
      )
    );
    expect(row).toEqual({ review_status: "pending", reviewed_by: null });
  });

  it("changing a rejected food's facts sends it back for review; renaming nothing keeps it rejected", async () => {
    const [{ id }] = await insertOwn(user);
    await t.as(admin, () => t.rows("update public.foods set review_status = 'rejected', reviewed_by = $2 where id = $1", [id, admin]));
    const [same] = await t.as(user, () => t.rows<{ review_status: string }>("update public.foods set updated_at = now() where id = $1 returning review_status", [id]));
    expect(same.review_status).toBe("rejected");
    const [edited] = await t.as(user, () => t.rows<{ review_status: string; reviewed_by: string }>("update public.foods set kcal = 350 where id = $1 returning review_status, reviewed_by", [id]));
    expect(edited).toEqual({ review_status: "pending", reviewed_by: admin });
  });

  it("admins and imports are not forced into the queue", async () => {
    const [g] = await t.as(admin, () => t.rows<{ review_status: string | null }>(`insert into public.foods (${FOOD}) values (${VALS}) returning review_status`));
    expect(g.review_status).toBeNull();
  });
});

describe("rejection reason (AUD-15)", () => {
  it("the creator reads the admin's reason but can't write one", async () => {
    const [{ id }] = await insertOwn(user);
    await t.as(admin, () => t.rows("update public.foods set review_status = 'rejected', review_note = 'Label photo needed' where id = $1", [id]));
    const [row] = await t.as(user, () =>
      t.rows<{ review_note: string }>("update public.foods set review_note = 'approved by me' where id = $1 returning review_note", [id])
    );
    expect(row.review_note).toBe("Label photo needed");
  });
});
