import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";
let t: TestDb;
let user: string;
let other: string;
beforeAll(async () => { t = await createTestDb(); user = await t.user("audit@example.com"); other = await t.user("other@example.com"); }, 60000);
afterAll(async () => { await t.db.close(); });
// Characterization tests: these passing assertions demonstrate current defects,
// not desired acceptance criteria. Invert them when fixing the findings.
it("AUD-05: users can omit food review and forge review provenance", async () => {
 const [f] = await t.as(user, () => t.rows<{id:string;review_status:string|null}>("insert into public.foods(name,kcal,protein_g,carbs_g,fat_g,owner_id) values ('Audit food',100,1,2,3,$1) returning id,review_status", [user]));
 expect(f.review_status).toBeNull();
 const [edited] = await t.as(user, () => t.rows<{reviewed_by:string}>("update public.foods set reviewed_by=$2, reviewed_at=now() where id=$1 returning reviewed_by", [f.id,other]));
 expect(edited.reviewed_by).toBe(other);
 expect(await t.as(other, () => t.rows("select id from public.foods where id=$1", [f.id]))).toHaveLength(0);
});
it("AUD-06: claims alone suppress a reminder even if delivery failed", async () => {
 await t.admin(() => t.rows("insert into public.reminder_log(user_id,slot,local_date) values($1,'lunch','2026-11-12')",[user]));
 const {dueSlots}=await import("../../src/lib/reminders");
 const sent=await t.admin(() => t.rows<{slot:string}>("select slot from public.reminder_log where user_id=$1 and local_date='2026-11-12'",[user]));
 expect(dueSlots({timezone:"UTC",breakfast:null,lunch:"12:00",dinner:null},{date:"2026-11-12",minutes:725},new Set(),new Set(sent.map(s=>s.slot))).slots).toEqual([]);
});
