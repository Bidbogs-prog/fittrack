import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * In-process Postgres (PGlite, WASM) with the parts of Supabase our
 * migrations depend on stubbed: the anon/authenticated roles, auth.users,
 * auth.uid() reading the JWT subject from a session setting, and the storage
 * tables. Every migration in supabase/migrations is then applied in order,
 * so tests exercise the real RLS policies and SQL functions.
 */
const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant select on auth.users to service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export interface TestDb {
  db: PGlite;
  /** Create a confirmed auth user (and its profile, via the signup trigger if present). */
  user(email: string): Promise<string>;
  /** Run as this signed-in user (role authenticated, auth.uid() = id). */
  as<T>(userId: string | null, fn: () => Promise<T>): Promise<T>;
  /** Run as the database owner (bypasses RLS) — test setup only. */
  admin<T>(fn: () => Promise<T>): Promise<T>;
  rows<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export async function createTestDb(): Promise<TestDb> {
  const db = await PGlite.create();
  await db.exec(SUPABASE_STUBS);
  const dir = join(process.cwd(), "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(dir, file), "utf8"));
    } catch (err) {
      throw new Error(`migration ${file} failed: ${(err as Error).message}`);
    }
  }

  let n = 0;
  const api: TestDb = {
    db,
    async user(email) {
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
      await api.admin(() =>
        db.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [id, email])
      );
      return id;
    },
    async as(userId, fn) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
      await db.exec(userId ? "set role authenticated" : "set role anon");
      try {
        return await fn();
      } finally {
        await db.exec("reset role");
        await db.query("select set_config('request.jwt.claim.sub', '', false)");
      }
    },
    async admin(fn) {
      await db.exec("reset role");
      return fn();
    },
    async rows(sql, params) {
      return (await db.query(sql, params)).rows as never;
    },
  };
  return api;
}
