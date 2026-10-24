import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

/**
 * Row-level security — system-level security tests against the real
 * migrations (risk R4/R6). Two users, A and B: each must only see and change
 * their own rows, and no one may grant themselves premium, beta access or
 * reset their AI usage.
 */
let t: TestDb;
let a: string;
let b: string;

beforeAll(async () => {
  t = await createTestDb();
  a = await t.user("a@example.com");
  b = await t.user("b@example.com");
}, 60_000);

const count = async (sql: string, params?: unknown[]) =>
  (await t.rows<{ n: number }>(`select count(*)::int as n from (${sql}) x`, params))[0].n;

describe("profiles", () => {
  it("signup trigger created a profile for each user", async () => {
    expect(await t.admin(() => count("select 1 from public.profiles where id in ($1, $2)", [a, b]))).toBe(2);
  });
  it("A sees only A's profile", async () => {
    const ids = await t.as(a, () => t.rows<{ id: string }>("select id from public.profiles"));
    expect(ids.map((r) => r.id)).toEqual([a]);
  });
  it("A cannot update B's profile", async () => {
    await t.as(a, () => t.rows("update public.profiles set full_name = 'hacked' where id = $1", [b]));
    const [row] = await t.admin(() => t.rows<{ full_name: string | null }>("select full_name from public.profiles where id = $1", [b]));
    expect(row.full_name).not.toBe("hacked");
  });
});

describe("coach conversations and messages", () => {
  let convoA: string;
  beforeAll(async () => {
    [{ id: convoA }] = await t.as(a, () =>
      t.rows<{ id: string }>("insert into public.coach_conversations (title) values ('mine') returning id")
    );
  });
  it("B cannot read A's conversation", async () => {
    expect(await t.as(b, () => count("select 1 from public.coach_conversations"))).toBe(0);
  });
  it("B cannot post a message into A's conversation", async () => {
    await expect(
      t.as(b, () => t.rows("insert into public.coach_messages (conversation_id, role, content) values ($1, 'user', 'hi')", [convoA]))
    ).rejects.toThrow(/row-level security/);
  });
  it("A cannot create a conversation owned by B", async () => {
    await expect(
      t.as(a, () => t.rows("insert into public.coach_conversations (user_id, title) values ($1, 'x')", [b]))
    ).rejects.toThrow(/row-level security/);
  });
});

describe("coach memories", () => {
  it("are private to their owner", async () => {
    await t.as(a, () => t.rows("insert into public.coach_memories (fact) values ('They don''t eat pork.')"));
    expect(await t.as(a, () => count("select 1 from public.coach_memories"))).toBe(1);
    expect(await t.as(b, () => count("select 1 from public.coach_memories"))).toBe(0);
  });
});

describe("privilege escalation", () => {
  it("a user cannot grant themselves premium", async () => {
    await expect(
      t.as(a, () => t.rows("insert into public.entitlements (user_id, source) values ($1, 'manual')", [a]))
    ).rejects.toThrow(/row-level security/);
  });
  it("a user cannot extend an existing premium grant", async () => {
    await t.admin(() =>
      t.rows("insert into public.entitlements (user_id, source, current_period_end) values ($1, 'manual', now() + interval '1 day')", [b])
    );
    await t.as(b, () => t.rows("update public.entitlements set current_period_end = null where user_id = $1", [b]));
    const [row] = await t.admin(() => t.rows<{ current_period_end: string | null }>("select current_period_end from public.entitlements where user_id = $1", [b]));
    expect(row.current_period_end).not.toBeNull();
  });
  it("a user cannot give themselves beta access", async () => {
    await expect(
      t.as(a, () => t.rows("insert into public.beta_access (user_id, via) values ($1, 'manual')", [a]))
    ).rejects.toThrow(/row-level security/);
  });
  it("the internal grant function is not callable by users", async () => {
    await expect(
      t.as(a, () => t.rows("select public.grant_beta_access($1, 'manual', null, null, 3650)", [a]))
    ).rejects.toThrow(/permission denied/);
  });
  it("a user cannot list invite codes", async () => {
    await t.admin(() => t.rows("insert into public.invite_codes (code) values ('SECRET-1')"));
    expect(await t.as(a, () => count("select 1 from public.invite_codes"))).toBe(0);
  });
  it("anonymous visitors cannot read the waitlist", async () => {
    await t.as(null, () => t.rows("select * from public.join_waitlist('w@example.com', 'en', null, null, null, null, null)"));
    expect(await t.as(null, () => count("select 1 from public.waitlist"))).toBe(0);
  });
});

describe("AI usage metering", () => {
  it("a user can record usage but cannot delete it to reset their caps", async () => {
    await t.as(a, () => t.rows("insert into public.ai_usage (feature, provider, model) values ('coach', 'llmgateway', 'm')"));
    await t.as(a, () => t.rows("delete from public.ai_usage"));
    expect(await t.admin(() => count("select 1 from public.ai_usage where user_id = $1", [a]))).toBe(1);
  });
  it("B cannot see A's usage", async () => {
    expect(await t.as(b, () => count("select 1 from public.ai_usage"))).toBe(0);
  });
  it("a user cannot record usage against someone else", async () => {
    await expect(
      t.as(b, () => t.rows("insert into public.ai_usage (user_id, feature, provider, model) values ($1, 'coach', 'x', 'm')", [a]))
    ).rejects.toThrow(/row-level security/);
  });
});
