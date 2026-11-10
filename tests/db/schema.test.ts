import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { createTestDb, SUPABASE_STUBS } from "./harness";

/**
 * supabase/schema.sql is the documented way to set up a fresh database
 * (README), separate from the migrations production uses. Audit #3 found it
 * failing on a fresh database (sections referenced tables defined further
 * down) and regressing a draft-plan policy. These checks keep it runnable
 * and in step with the migrations.
 */
async function fromSchema(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(SUPABASE_STUBS);
  await db.exec(readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8"));
  return db;
}

const CATALOG = {
  tables: "select table_name as k from information_schema.tables where table_schema = 'public' order by 1",
  columns:
    "select table_name || '.' || column_name as k from information_schema.columns where table_schema = 'public' order by 1",
  policies:
    "select tablename || ': ' || policyname || ' [' || cmd || '] ' || coalesce(qual, '') || ' | ' || coalesce(with_check, '') as k from pg_policies where schemaname = 'public' order by 1",
  functions:
    "select p.proname as k from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1",
  indexes: "select indexname as k from pg_indexes where schemaname = 'public' order by 1",
} as const;

async function keys(db: PGlite, sql: string): Promise<string[]> {
  return ((await db.query<{ k: string }>(sql)).rows ?? []).map((r) => r.k.replace(/\s+/g, " "));
}

describe("supabase/schema.sql", () => {
  it("applies cleanly to a fresh database", async () => {
    await expect(fromSchema()).resolves.toBeDefined();
  }, 60_000);

  it("ends in the same state as the migrations (tables, columns, policies, functions)", async () => {
    const [schema, migrated] = await Promise.all([fromSchema(), createTestDb().then((t) => t.db)]);
    for (const [name, sql] of Object.entries(CATALOG)) {
      const [a, b] = await Promise.all([keys(schema, sql), keys(migrated, sql)]);
      expect(a, `${name} differ between schema.sql and migrations`).toEqual(b);
    }
  }, 120_000);
});
