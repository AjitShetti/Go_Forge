// P5 database behavior: design versions on real Postgres (PGlite) with every
// migration applied and Supabase-style roles.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..", "..");
const A = "00000000-0000-0000-0000-0000000000a5";
const B = "00000000-0000-0000-0000-0000000000b5";
const KEY = "11111111-2222-3333-4444-555555555555";
const GRAPH = JSON.stringify({ schema: "go-forge/design-graph@1", nodes: [], edges: [] });

let db: PGlite;

async function as(role: "anon" | "authenticated" | "postgres", sub: string | null) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [sub ? JSON.stringify({ sub, role }) : ""]);
  if (role !== "postgres") await db.exec(`set role ${role}`);
}

const insert = (version: number, key = KEY, graph = GRAPH, name = "Ticketing") =>
  db.query("insert into public.designs (design_key, name, graph, version) values ($1, $2, $3::jsonb, $4)", [key, name, graph, version]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(root, "tests", "db", "supabase-shim.sql"), "utf8"));
  for (const f of readdirSync(join(root, "supabase", "migrations")).sort()) {
    await db.exec(readFileSync(join(root, "supabase", "migrations", f), "utf8"));
  }
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com')`);
});

describe("designs", () => {
  it("an owner saves versions 1 and 2 of a design; a repeated version number is refused", async () => {
    await as("authenticated", A);
    await insert(1);
    await insert(2);
    await expect(insert(2)).rejects.toThrow(/duplicate key/);
    const r = await db.query("select version from public.designs order by version");
    expect(r.rows).toEqual([{ version: 1 }, { version: 2 }]);
  });

  it("another user can't read them, and reusing the key can't block the owner's next save", async () => {
    await as("authenticated", B);
    expect((await db.query("select * from public.designs")).rows).toEqual([]);
    // Before the P5 migration this row would take version 3 of A's design globally.
    await insert(3);
    await as("authenticated", A);
    await insert(3);
    expect((await db.query("select version from public.designs order by version")).rows).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
  });

  it("nobody can write a version as someone else", async () => {
    await as("authenticated", B);
    await expect(db.query("insert into public.designs (user_id, design_key, name, graph, version) values ($1, $2, 'x', $3::jsonb, 9)", [A, KEY, GRAPH])).rejects.toThrow(/row-level security/);
  });

  it("versions are immutable: no update policy, so updates touch nothing", async () => {
    await as("authenticated", A);
    const r = await db.query("update public.designs set name = 'rewritten' where design_key = $1", [KEY]);
    expect(r.affectedRows).toBe(0);
    expect((await db.query("select distinct name from public.designs")).rows).toEqual([{ name: "Ticketing" }]);
  });

  it("the graph must be a JSON object under 1 MiB and the name 1–120 characters", async () => {
    await as("authenticated", A);
    const key = "99999999-2222-3333-4444-555555555555";
    await expect(insert(1, key, "[]")).rejects.toThrow(/designs_graph_object/);
    await expect(insert(1, key, JSON.stringify({ blob: "x".repeat(1_100_000) }))).rejects.toThrow(/designs_graph_size/);
    await expect(insert(1, key, GRAPH, "")).rejects.toThrow(/designs_name_length/);
    await expect(insert(1, key, GRAPH, "n".repeat(121))).rejects.toThrow(/designs_name_length/);
  });

  it("delete removes only the caller's own versions", async () => {
    await as("authenticated", B);
    const r = await db.query("delete from public.designs where design_key = $1", [KEY]);
    expect(r.affectedRows).toBe(1); // B's own stray row
    await as("authenticated", A);
    expect((await db.query("select count(*)::int n from public.designs")).rows).toEqual([{ n: 3 }]);
  });

  it("anon sees and writes nothing", async () => {
    await as("anon", null);
    await expect(db.query("select * from public.designs")).rejects.toThrow(/permission denied/);
    await expect(insert(1)).rejects.toThrow(/permission denied/);
  });
});
