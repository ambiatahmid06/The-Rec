// A throwaway in-memory Postgres (PGlite) with just enough of Supabase faked
// (roles, auth.users, auth.uid(), storage) to run our migrations and test
// Row Level Security as different signed-in users. No Docker needed.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations')

// Mirrors the bits of a real Supabase database that our migrations rely on.
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    email_confirmed_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
    declare parts text[] := string_to_array(name, '/');
    begin return parts[1:array_length(parts, 1) - 1]; end
  $$;
  grant usage on schema storage to anon, authenticated;
  grant all on storage.objects to anon, authenticated;

  -- Our Supabase project does NOT give the API roles read/write access to new
  -- tables by default (only REFERENCES, TRIGGER, TRUNCATE), so every migration
  -- must GRANT what the app needs. Functions are executable by default.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant references, trigger, truncate on tables to anon, authenticated;
  alter default privileges in schema public grant all on tables to service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to service_role;
`

export async function createTestDb() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUBS)
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  return db
}

type Db = Awaited<ReturnType<typeof createTestDb>>

/** Creates an auth user, and (by default) their profile, like signing up + onboarding. */
export async function addUser(
  db: Db,
  username: string,
  options: { email?: string; confirmed?: boolean; withProfile?: boolean } = {},
) {
  const id = crypto.randomUUID()
  const email = options.email ?? `${username}@example.com`
  await db.query(
    'insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)',
    [id, email, options.confirmed === false ? null : new Date().toISOString()],
  )
  if (options.withProfile !== false) {
    await db.query(
      'insert into public.profiles (id, username, display_name) values ($1, $2, $3)',
      [id, username, username.toUpperCase()],
    )
  }
  return id
}

/** Runs SQL as a signed-in user (or as an anonymous visitor when userId is null), with RLS applied. */
export function as(db: Db, userId: string | null) {
  return {
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      return db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ''])
        await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`)
        const result = await tx.query<T>(sql, params)
        return result.rows
      })
    },
  }
}
