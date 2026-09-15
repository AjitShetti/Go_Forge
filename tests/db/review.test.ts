// P4 database behavior: review predictions and the mastery cache, on real
// Postgres (PGlite) with every migration applied and Supabase-style roles.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..", "..");
const A = "00000000-0000-0000-0000-0000000000a1";
const B = "00000000-0000-0000-0000-0000000000b1";
const REF = "go/m3-slices-maps/nil-maps";

let db: PGlite;
let lessonId: string;
let conceptId: string;

async function as(role: "authenticated" | "postgres", sub: string | null) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [sub ? JSON.stringify({ sub, role }) : ""]);
  if (role !== "postgres") await db.exec(`set role ${role}`);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(root, "tests", "db", "supabase-shim.sql"), "utf8"));
  for (const f of readdirSync(join(root, "supabase", "migrations")).sort()) {
    await db.exec(readFileSync(join(root, "supabase", "migrations", f), "utf8"));
  }
  await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com')`);
  lessonId = (await db.query<{ id: string }>("select id from public.lessons where content_ref = $1", [REF])).rows[0].id;
  conceptId = (await db.query<{ id: string }>("select id from public.concepts where slug = 'nil-map'")).rows[0].id;
});

describe("predictions.source", () => {
  it("defaults to 'trap', so lesson-player inserts are unchanged", async () => {
    await as("authenticated", A);
    const r = await db.query<{ source: string }>(
      "insert into public.predictions (lesson_id, concept_id, text, correct) values ($1, $2, 'x', false) returning source",
      [lessonId, conceptId],
    );
    expect(r.rows[0].source).toBe("trap");
  });

  it("accepts a review card source and rejects anything else", async () => {
    await as("authenticated", A);
    const ok = await db.query<{ source: string }>(
      "insert into public.predictions (lesson_id, concept_id, text, correct, source) values ($1, $2, 'map[a:1] 8', true, $3) returning source",
      [lessonId, conceptId, `review:${REF}#map-is-a-pointer`],
    );
    expect(ok.rows[0].source).toBe(`review:${REF}#map-is-a-pointer`);
    await expect(
      db.query("insert into public.predictions (lesson_id, concept_id, text, correct, source) values ($1, $2, 'x', true, 'anything')", [lessonId, conceptId]),
    ).rejects.toThrow(/check constraint/);
  });

  it("stays private to its owner", async () => {
    await as("authenticated", B);
    const r = await db.query("select * from public.predictions");
    expect(r.rows).toEqual([]);
  });
});

describe("mastery cache", () => {
  const upsert = `insert into public.mastery (concept_id, state, streak, ease, interval_days, error_count, last_seen, next_review)
    values ($1, $2, $3, $4, $5, $6, now(), now() + interval '1 day')
    on conflict (user_id, concept_id) do update set state = excluded.state, streak = excluded.streak, ease = excluded.ease,
      interval_days = excluded.interval_days, error_count = excluded.error_count, last_seen = excluded.last_seen, next_review = excluded.next_review`;

  it("an owner can insert and then update their own row with the same upsert", async () => {
    await as("authenticated", A);
    await db.query(upsert, [conceptId, "learning", 0, 1.96, 1, 1]);
    await db.query(upsert, [conceptId, "review", 2, 2.5, 3, 1]);
    const r = await db.query<{ state: string; streak: number; error_count: number }>("select state, streak, error_count from public.mastery");
    expect(r.rows).toEqual([{ state: "review", streak: 2, error_count: 1 }]);
  });

  it("rejects states outside the schema's set", async () => {
    await as("authenticated", A);
    await expect(db.query(upsert, [conceptId, "expert", 0, 2.5, 1, 0])).rejects.toThrow(/check constraint/);
  });

  it("another user neither sees nor overwrites it", async () => {
    await as("authenticated", B);
    expect((await db.query("select * from public.mastery")).rows).toEqual([]);
    await db.query(upsert, [conceptId, "mastered", 9, 2.5, 30, 0]);
    await as("postgres", null);
    const rows = await db.query<{ user_id: string; state: string }>("select user_id, state from public.mastery order by user_id");
    expect(rows.rows).toEqual([
      { user_id: A, state: "review" },
      { user_id: B, state: "mastered" },
    ]);
  });
});
