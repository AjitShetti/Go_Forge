// Row Level Security tests: the real migration + seed applied to real Postgres
// (PGlite) with a Supabase-shaped auth shim. Each test switches role exactly
// the way PostgREST does (SET ROLE + request.jwt.claims).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..", "..");
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

let db: PGlite;

async function as(role: "anon" | "authenticated" | "postgres", sub: string | null) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [sub ? JSON.stringify({ sub, role }) : ""]);
  if (role !== "postgres") await db.exec(`set role ${role}`);
}

async function lessonId(): Promise<string> {
  await as("postgres", null);
  const r = await db.query<{ id: string }>("select id from public.lessons where content_ref = 'go/m3-slices-maps/slice-aliasing'");
  return r.rows[0].id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(root, "tests", "db", "supabase-shim.sql"), "utf8"));
  for (const f of readdirSync(join(root, "supabase", "migrations")).sort()) {
    await db.exec(readFileSync(join(root, "supabase", "migrations", f), "utf8"));
  }
  const seed = readFileSync(join(root, "supabase", "seed.sql"), "utf8");
  await db.exec(seed);
  await db.exec(seed); // idempotent
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com')`);
});

describe("schema + seed", () => {
  it("seeds the curriculum idempotently", async () => {
    await as("postgres", null);
    const counts = await db.query<{ modules: number; lessons: number; concepts: number }>(
      "select (select count(*)::int from public.modules) modules, (select count(*)::int from public.lessons) lessons, (select count(*)::int from public.concepts) concepts",
    );
    expect(counts.rows[0]).toEqual({ modules: 13, lessons: 43, concepts: 52 });
  });

  it("every public table has RLS enabled", async () => {
    await as("postgres", null);
    const r = await db.query<{ relname: string }>(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
    );
    expect(r.rows).toEqual([]);
  });

  it("creates a profile row on signup", async () => {
    await as("postgres", null);
    const r = await db.query("select id, email from public.profiles order by email");
    expect(r.rows).toEqual([
      { id: A, email: "a@example.com" },
      { id: B, email: "b@example.com" },
    ]);
  });
});

describe("content tables are read-only to clients", () => {
  it("anon can read lessons", async () => {
    await as("anon", null);
    const r = await db.query("select count(*)::int n from public.lessons");
    expect(r.rows[0]).toEqual({ n: 43 });
  });

  it("anon cannot write content", async () => {
    await as("anon", null);
    await expect(db.query("insert into public.concepts (slug, title) values ('x', 'x')")).rejects.toThrow(/permission denied/);
  });

  it("authenticated cannot insert, update or delete content", async () => {
    await as("authenticated", A);
    await expect(db.query("insert into public.concepts (slug, title) values ('x', 'x')")).rejects.toThrow(/row-level security/);
    const upd = await db.query("update public.lessons set title = 'hacked'");
    expect(upd.affectedRows).toBe(0);
    const del = await db.query("delete from public.lessons");
    expect(del.affectedRows).toBe(0);
  });
});

describe("user tables are private per user", () => {
  it("a user can insert and read their own prediction", async () => {
    const lesson = await lessonId();
    await as("authenticated", A);
    await db.query("insert into public.predictions (lesson_id, text, correct) values ($1, 'A guess', false)", [lesson]);
    const r = await db.query<{ user_id: string }>("select user_id from public.predictions");
    expect(r.rows).toEqual([{ user_id: A }]);
  });

  it("a user cannot insert a row owned by someone else", async () => {
    const lesson = await lessonId();
    await as("authenticated", A);
    await expect(
      db.query("insert into public.predictions (user_id, lesson_id, text, correct) values ($1, $2, 'forged', true)", [B, lesson]),
    ).rejects.toThrow(/row-level security/);
  });

  it("another user sees none of it, and anon is refused", async () => {
    await as("authenticated", B);
    const r = await db.query("select * from public.predictions");
    expect(r.rows).toEqual([]);
    await as("anon", null);
    await expect(db.query("select * from public.predictions")).rejects.toThrow(/permission denied/);
  });

  it("learning history is append-only", async () => {
    await as("authenticated", A);
    const upd = await db.query("update public.predictions set correct = true");
    expect(upd.affectedRows).toBe(0);
    const del = await db.query("delete from public.predictions");
    expect(del.affectedRows).toBe(0);
    await as("postgres", null);
    const r = await db.query<{ correct: boolean }>("select correct from public.predictions");
    expect(r.rows).toEqual([{ correct: false }]);
  });

  it("users see only their own profile", async () => {
    await as("authenticated", B);
    const r = await db.query<{ id: string }>("select id from public.profiles");
    expect(r.rows).toEqual([{ id: B }]);
  });

  it("mastery can be updated only for oneself", async () => {
    await as("postgres", null);
    const c = await db.query<{ id: string }>("select id from public.concepts where slug = 'slice-header'");
    const concept = c.rows[0].id;
    await as("authenticated", A);
    await db.query("insert into public.mastery (concept_id, state) values ($1, 'learning')", [concept]);
    await as("authenticated", B);
    const upd = await db.query("update public.mastery set state = 'mastered'");
    expect(upd.affectedRows).toBe(0);
    await as("authenticated", A);
    const own = await db.query("update public.mastery set state = 'review'");
    expect(own.affectedRows).toBe(1);
  });

  it("design reviews follow design ownership", async () => {
    await as("authenticated", A);
    const d = await db.query<{ id: string }>("insert into public.designs (graph, version) values ('{}', 1) returning id");
    const designId = d.rows[0].id;
    await db.query("insert into public.design_reviews (design_id, score) values ($1, 80)", [designId]);

    await as("authenticated", B);
    await expect(db.query("insert into public.design_reviews (design_id, score) values ($1, 100)", [designId])).rejects.toThrow(
      /row-level security/,
    );
    expect((await db.query("select * from public.design_reviews")).rows).toEqual([]);
    expect((await db.query("select * from public.designs")).rows).toEqual([]);

    await as("authenticated", A);
    expect((await db.query("select score from public.design_reviews")).rows).toEqual([{ score: 80 }]);
  });
});
