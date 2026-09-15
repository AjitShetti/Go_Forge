// P5 end-to-end check: the design canvas in a real browser (installed Edge,
// headless) against a production build. Signed out first (build, connect,
// configure, export, import), then signed in as the e2e user against the live
// Supabase project (save, reload, versions, diff, conflict, delete).
//
//   npm run build && node scripts/verify-p5.mjs
//
// Needs E2E_EMAIL / E2E_PASSWORD in .env.local and no saved designs for the
// e2e user (reset: supabase/e2e-reset.sql).
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright-core";
import { loadEnvLocal } from "./verify-p2-persistence.mjs";

const root = resolve(import.meta.dirname, "..");
const PORT = 3210;
const BASE = `http://localhost:${PORT}`;
const shots = join(root, "docs", "evidence", "screens");
mkdirSync(shots, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "goforge-p5-"));

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail && !ok ? "\n      " + detail : ""}`);
};

const server = spawn(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)], { cwd: root, stdio: "pipe" });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
for (let i = 0; ; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {}
  if (i > 120) throw new Error("next start did not come up:\n" + serverLog);
  await new Promise((r) => setTimeout(r, 500));
}

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "goforge-edge-")), { channel: "msedge", headless: true, viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const pageErrors = [];
const watch = (p, tag) => {
  p.on("pageerror", (e) => pageErrors.push(`[${tag}] ${e}`));
  p.on("console", (m) => m.type() === "error" && pageErrors.push(`[${tag}] console: ${m.text()}`));
  p.on("dialog", (d) => d.accept());
};
watch(page, "main");

const state = (p = page) => p.evaluate(() => window.__designState);
const waitState = (fn, arg, p = page) => p.waitForFunction(fn, arg, { timeout: 30000 });
/** JSON with sorted object keys: jsonb does not keep key order. */
const stable = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const center = async (locator) => {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element has no box");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

/** Drag from one node's side handle to another node's side handle with the real mouse. */
async function connect(p, fromId, toId, fromSide = "right", toSide = "left") {
  await p.getByTestId(`node-${fromId}`).hover();
  const a = await center(p.locator(`[data-testid="node-${fromId}"] .react-flow__handle-${fromSide}`));
  await p.getByTestId(`node-${toId}`).hover();
  const b = await center(p.locator(`[data-testid="node-${toId}"] .react-flow__handle-${toSide}`));
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 8 });
  await p.mouse.move(b.x, b.y, { steps: 8 });
  await p.mouse.up();
}

async function clickEdge(p, id) {
  const c = await center(p.getByTestId(`edge-${id}`));
  await p.mouse.click(c.x, c.y);
}

async function selectNode(p, id) {
  await p.getByTestId(`node-${id}`).locator("p").first().click();
  await p.getByTestId("node-inspector").waitFor();
}

async function importFile(p, name, text) {
  const file = join(scratch, name);
  writeFileSync(file, text);
  await p.getByTestId("import-file").setInputFiles(file);
}

// A design using every node kind and every edge kind. Edges only join grid
// neighbours: straight edges between collinear nodes would overlap.
const kinds = ["client", "cdn", "rate_limiter", "load_balancer", "api_gateway", "app_service", "queue", "worker", "cache", "sql_db", "nosql", "object_store", "search_index", "pubsub", "cron"];
const FIXTURE = {
  schema: "go-forge/design-export@1",
  name: "Flash sale sketch",
  exportedAt: "2026-09-15T00:00:00.000Z",
  version: null,
  graph: {
    schema: "go-forge/design-graph@1",
    nodes: kinds.map((kind, i) => ({ id: `n-${kind.replace("_", "")}`, kind, position: { x: 40 + (i % 5) * 250, y: 40 + Math.floor(i / 5) * 190 } })),
    edges: [
      { id: "e-1", source: "n-client", target: "n-cdn", kind: "sync" },
      { id: "e-2", source: "n-appservice", target: "n-queue", kind: "async", label: "reserve seat" },
      { id: "e-3", source: "n-sqldb", target: "n-nosql", kind: "replication" },
      { id: "e-4", source: "n-worker", target: "n-cache", kind: "cache_read" },
      { id: "e-5", source: "n-cron", target: "n-searchindex", kind: "batch" },
      { id: "e-6", source: "n-cache", target: "n-sqldb", kind: "sync" },
    ],
  },
};
const FIXTURE_TEXT = JSON.stringify(FIXTURE, null, 2);

try {
  // ============================================================ signed out ===
  console.log("\n== P5 signed out ==");
  await page.goto(BASE + "/canvas");
  check("/canvas says saving needs sign-in", (await page.getByTestId("designs-gate").getAttribute("data-kind")) === "signed-out");
  check("grading is visibly NOT IMPLEMENTED (P6)", (await page.getByTestId("not-implemented").first().innerText()).includes("P6"));
  await page.getByTestId("new-design").click();
  await page.waitForURL(BASE + "/canvas/new");
  await page.getByTestId("canvas").waitFor();
  check("new design is marked NOT SAVED", (await page.getByTestId("design-status").getAttribute("data-kind")) === "not-saved");
  check("Save is disabled signed out", await page.getByTestId("save-design").isDisabled());
  check("palette lists 15 component kinds", (await page.locator('[data-testid^="palette-"]').count()) === 15);

  // Click-to-add and HTML5 drag-and-drop.
  await page.getByTestId("palette-client").click();
  await waitState(() => window.__designState?.graph.nodes.length === 1);
  check("click adds a Client node", (await state()).graph.nodes[0].kind === "client");
  const canvasBox = await page.getByTestId("canvas").boundingBox();
  await page.getByTestId("palette-app_service").dragTo(page.getByTestId("canvas"), { targetPosition: { x: canvasBox.width * 0.75, y: canvasBox.height * 0.3 } });
  await waitState(() => window.__designState?.graph.nodes.length === 2);
  let s = await state();
  const clientId = s.graph.nodes[0].id;
  const appId = s.graph.nodes[1].id;
  check("drag-and-drop adds an App Service node where it was dropped", s.graph.nodes[1].kind === "app_service" && s.graph.nodes[1].position.x > s.graph.nodes[0].position.x);
  check("new node gets the kind's defaults", JSON.stringify(s.graph.nodes[1].config) === JSON.stringify({ label: "App Service", replicas: 3, region: "us-east-1", qpsIn: 2000, qpsOut: 1000, p99Ms: 50 }));

  // Connect with the mouse.
  await page.getByTestId("canvas").click({ position: { x: 20, y: 20 } }); // clear selection
  await page.getByTestId("connect-kind-sync").check();
  await connect(page, clientId, appId);
  await waitState(() => window.__designState?.graph.edges.length === 1);
  s = await state();
  const edgeId = s.graph.edges[0].id;
  check("dragging handle to handle creates a sync edge", s.graph.edges[0].source === clientId && s.graph.edges[0].target === appId && s.graph.edges[0].kind === "sync");
  await connect(page, clientId, appId);
  await page.getByTestId("canvas-notice").waitFor();
  check("an exact duplicate connection is refused with a reason", (await page.getByTestId("canvas-notice").innerText()).includes("already exists") && (await state()).graph.edges.length === 1);

  // Edge inspector.
  await clickEdge(page, edgeId);
  await page.getByTestId("edge-inspector").waitFor();
  await page.getByTestId("edge-kind-async").check();
  await page.getByTestId("edge-label").fill("POST /orders");
  await waitState(() => window.__designState?.graph.edges[0].kind === "async" && window.__designState.graph.edges[0].label === "POST /orders");
  check("edge kind and label edit through the inspector", true);
  check("edge chip renders the new kind", (await page.getByTestId(`edge-${edgeId}`).getAttribute("data-kind")) === "async");
  await page.getByTestId("reverse-edge").click();
  await waitState((a) => window.__designState?.graph.edges[0].source === a, appId);
  check("reverse swaps direction", true);
  await page.getByTestId("reverse-edge").click();
  await waitState((c) => window.__designState?.graph.edges[0].source === c, clientId);

  // Node inspector.
  await selectNode(page, appId);
  await page.getByTestId("inspector-replicas").fill("5");
  await page.getByTestId("inspector-qpsIn").fill("2500");
  await waitState((id) => window.__designState?.graph.nodes.find((n) => n.id === id)?.config.replicas === 5, appId);
  check("capacity shows the arithmetic", (await page.getByTestId("inspector-capacity").innerText()).includes("5 × 2,500 = 12.5k rps"));
  await page.getByTestId("inspector-replicas").fill("0");
  await page.waitForTimeout(150);
  check("an out-of-range value is shown as invalid and not committed", (await page.getByTestId("inspector-replicas").getAttribute("aria-invalid")) === "true" && (await state()).graph.nodes.find((n) => n.id === appId).config.replicas === 5);
  await page.getByTestId("inspector-replicas").fill("5");
  await page.getByTestId("inspector-region").selectOption("ap-south-1");
  await page.getByTestId("inspector-label").fill("Checkout API");
  await waitState((id) => window.__designState?.graph.nodes.find((n) => n.id === id)?.config.label === "Checkout API", appId);
  check("region and name edit through the inspector", (await state()).graph.nodes.find((n) => n.id === appId).config.region === "ap-south-1");
  check("node face shows the new name and summary", (await page.getByTestId(`node-${appId}`).innerText()).includes("Checkout API") && (await page.getByTestId(`node-${appId}`).innerText()).includes("5×"));

  // SQL DB role toggle.
  await page.getByTestId("palette-sql_db").click();
  await waitState(() => window.__designState?.graph.nodes.length === 3);
  const dbId = (await state()).graph.nodes[2].id;
  await page.getByTestId("inspector-role").selectOption("replica");
  await waitState((id) => window.__designState?.graph.nodes.find((n) => n.id === id)?.config.role === "replica", dbId);
  check("SQL DB primary/replica toggle", (await page.getByTestId(`node-${dbId}`).innerText()).includes("REPLICA"));
  await page.getByTestId("inspector-persistence").uncheck();
  await waitState((id) => window.__designState?.graph.nodes.find((n) => n.id === id)?.config.persistence === false, dbId);
  check("persistence toggle", true);

  // Export.
  await page.getByTestId("design-name").fill("Scratch checkout");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-design").click()]);
  const exportedPath = join(scratch, "export.json");
  await download.saveAs(exportedPath);
  const exported = JSON.parse(readFileSync(exportedPath, "utf8"));
  check("export downloads a named JSON file", download.suggestedFilename() === "scratch-checkout.json", download.suggestedFilename());
  check(
    "export holds the graph exactly as edited",
    exported.schema === "go-forge/design-export@1" && exported.name === "Scratch checkout" && exported.graph.nodes.length === 3 && exported.graph.edges[0].label === "POST /orders" && exported.graph.nodes.find((n) => n.id === appId).config.replicas === 5,
  );

  // Delete with the keyboard removes the node and its edges.
  await selectNode(page, clientId);
  await page.keyboard.press("Delete");
  await waitState(() => window.__designState?.graph.nodes.length === 2);
  check("Delete key removes a node and its connections", (await state()).graph.edges.length === 0);

  // Import: a bad file is refused, the canvas unchanged; the exported file restores everything.
  await importFile(page, "bad.json", JSON.stringify({ ...FIXTURE, graph: { ...FIXTURE.graph, nodes: [{ id: "x", kind: "mainframe", position: { x: 0, y: 0 } }] } }));
  await page.getByTestId("import-errors").waitFor();
  check("a bad import lists its problems and changes nothing", (await page.getByTestId("import-errors").innerText()).includes('"mainframe" is not a node kind') && (await state()).graph.nodes.length === 2);
  await importFile(page, "export.json", readFileSync(exportedPath, "utf8"));
  await waitState(() => window.__designState?.graph.nodes.length === 3 && window.__designState.graph.edges.length === 1);
  s = await state();
  check("re-importing the export restores the exact graph", JSON.stringify(s.graph) === JSON.stringify(exported.graph), `${JSON.stringify(s.graph)}\n      vs ${JSON.stringify(exported.graph)}`);

  await importFile(page, "fixture.json", FIXTURE_TEXT);
  await waitState(() => window.__designState?.graph.nodes.length === 15);
  const edgeKinds = await page.locator('[data-testid^="edge-e-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")).sort());
  check("all 15 node kinds render", (await page.locator('.react-flow__node[data-id^="n-"]').count()) === 15);
  check("all 5 edge kinds render with their own style", JSON.stringify([...new Set(edgeKinds)]) === JSON.stringify(["async", "batch", "cache_read", "replication", "sync"]));
  const dashes = await page.locator(".react-flow__edge-path").evaluateAll((els) => [...new Set(els.map((e) => `${e.style.strokeDasharray}|${e.style.strokeWidth}|${e.style.stroke}`))]);
  check("edge kinds differ in dash/width/colour (5 distinct looks)", dashes.length === 5, JSON.stringify(dashes));
  await page.getByTestId("canvas").click({ position: { x: 5, y: 5 } });
  await page.screenshot({ path: join(shots, "p5-canvas-all-kinds.png") });

  // ============================================================= signed in ===
  console.log("\n== P5 signed in (live Supabase, e2e user) ==");
  const env = loadEnvLocal(root);
  const jar = new Map();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
    },
  });
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD });
  check("e2e user signs in", !error && !!auth.user, error?.message);
  if (error) throw new Error("cannot continue signed-in checks");
  const { count: before } = await supabase.from("designs").select("id", { count: "exact", head: true });
  if (before > 0) {
    check("e2e user has no designs yet (run supabase/e2e-reset.sql)", false, `${before} rows exist`);
    throw new Error("not a clean slate");
  }
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", sameSite: "Lax" })));

  await page.goto(BASE + "/canvas");
  check("/canvas lists no designs yet", await page.getByTestId("no-designs").isVisible());

  // v1
  await page.goto(BASE + "/canvas/new");
  check("signed in, a new design is 'never saved'", (await page.getByTestId("design-status").getAttribute("data-kind")) === "new");
  await importFile(page, "fixture.json", FIXTURE_TEXT);
  await waitState(() => window.__designState?.graph.nodes.length === 15);
  const v1Graph = (await state()).graph;
  await page.getByTestId("save-design").click();
  await page.waitForURL(/\/canvas\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await page.getByTestId("design-status").waitFor();
  await waitState(() => document.querySelector('[data-testid="design-status"]')?.getAttribute("data-kind") === "saved");
  const key = page.url().split("/").pop();
  s = await state();
  check("save v1 moves to the design's URL and shows Saved · v1", s.baseVersion === 1 && (await page.getByTestId("design-status").innerText()).includes("V1"));
  const { data: rows1 } = await supabase.from("designs").select("design_key, version, name, graph").order("version");
  check("one row stored: version 1 with the exact graph", rows1.length === 1 && rows1[0].design_key === key && rows1[0].name === "Flash sale sketch" && stable(rows1[0].graph) === stable(v1Graph), JSON.stringify(rows1));

  await page.reload();
  await waitState(() => window.__designState?.graph.nodes.length === 15);
  check("reload loads v1 back identically, clean", JSON.stringify((await state()).graph) === JSON.stringify(v1Graph) && (await state()).dirty === false);
  check("Save is disabled with no changes", await page.getByTestId("save-design").isDisabled());

  // v2: change config, remove a node, add a node, change an edge kind.
  await selectNode(page, "n-appservice");
  await page.getByTestId("inspector-replicas").fill("12");
  await waitState(() => window.__designState?.graph.nodes.find((n) => n.id === "n-appservice")?.config.replicas === 12);
  check("an edit marks the design dirty", (await page.getByTestId("design-status").getAttribute("data-kind")) === "dirty");
  await selectNode(page, "n-objectstore");
  await page.getByTestId("delete-node").click();
  await clickEdge(page, "e-2");
  await page.getByTestId("edge-inspector").waitFor();
  await page.getByTestId("edge-kind-sync").check();
  await page.getByTestId("palette-pubsub").click();
  await waitState(() => window.__designState?.graph.nodes.length === 15 && window.__designState.graph.edges.find((e) => e.id === "e-2")?.kind === "sync");
  const addedId = (await state()).graph.nodes.at(-1).id;
  await clickEdge(page, "e-1");
  await page.getByTestId("edge-inspector").waitFor();
  await page.getByTestId("delete-edge").click();
  await waitState(() => window.__designState?.graph.edges.length === 5);
  await page.keyboard.press("Control+s");
  await waitState(() => window.__designState?.baseVersion === 2 && window.__designState.status === "saved");
  check("Ctrl+S saves version 2", true);
  const v2Graph = (await state()).graph;

  // History and diff.
  await page.getByTestId("toggle-history").click();
  check("history lists v2 and v1", (await page.getByTestId("version-2").isVisible()) && (await page.getByTestId("version-1").isVisible()));
  await page.getByTestId("diff-1").click();
  await page.waitForURL(`${BASE}/canvas/${key}/diff?from=1&to=2`);
  await page.getByTestId("diff-summary").waitFor();
  const summary = await page.getByTestId("diff-summary").innerText();
  check("diff lists the added node", (await page.getByTestId("diff-added-nodes").innerText()).includes("Pub/Sub Topic"));
  check("diff lists the removed node", (await page.getByTestId("diff-removed-nodes").innerText()).includes("Object Store"));
  check("diff lists the field change with before → after", /Replicas: 3 → 12/.test((await page.getByTestId("diff-changed-nodes").innerText()).replace(/\s+/g, " ")), summary);
  check("diff lists the connection kind change", /Async event → Sync request/.test((await page.getByTestId("diff-changed-edges").innerText()).replace(/\s+/g, " ")));
  check("diff canvas marks nodes added/removed/changed", (await page.getByTestId(`node-${addedId}`).getAttribute("data-diff")) === "added" && (await page.getByTestId("node-n-objectstore").getAttribute("data-diff")) === "removed" && (await page.getByTestId("node-n-appservice").getAttribute("data-diff")) === "changed");
  // v2 kept 5 edges; the deleted e-1 is drawn as a ghost. e-2 changed kind, e-4 is untouched.
  check(
    "diff canvas draws every connection: changed, unchanged, and the removed one as a ghost",
    (await page.locator('[data-testid^="edge-e-"]').count()) === 6 &&
      (await page.getByTestId("edge-e-2").getAttribute("data-diff")) === "changed" &&
      (await page.getByTestId("edge-e-4").getAttribute("data-diff")) === "" &&
      (await page.getByTestId("edge-e-1").getAttribute("data-diff")) === "removed",
  );
  check("diff lists the removed connection", (await page.getByTestId("diff-removed-edges").innerText()).includes("Client / Mobile → CDN (Sync request)"));
  await page.screenshot({ path: join(shots, "p5-diff.png") });
  await page.goto(`${BASE}/canvas/${key}/diff?from=2&to=2`);
  check("diff of a version with itself says so", await page.getByTestId("diff-empty").isVisible());
  await page.goto(`${BASE}/canvas/${key}/diff?from=2&to=1`);
  await page.getByTestId("diff-summary").waitFor();
  check("reverse diff (v2 → v1) flips added/removed", (await page.getByTestId(`node-${addedId}`).getAttribute("data-diff")) === "removed" && (await page.getByTestId("edge-e-1").getAttribute("data-diff")) === "added" && (await page.getByTestId("node-n-objectstore").getAttribute("data-diff")) === "added");

  // Open v1 in tab A; tab B saves v3 meanwhile; A's save is refused as a conflict, then forced.
  await page.goto(`${BASE}/canvas/${key}?v=1`);
  await waitState(() => window.__designState?.graph.nodes.length === 15);
  check("?v=1 opens version 1 with a banner that saving makes a new version", JSON.stringify((await state()).graph) === JSON.stringify(v1Graph) && (await page.getByTestId("old-version-banner").innerText()).includes("creates version 3"));
  const tabB = await ctx.newPage();
  watch(tabB, "tabB");
  await tabB.goto(`${BASE}/canvas/${key}`);
  await waitState(() => window.__designState?.baseVersion === 2, null, tabB);
  check("tab B opens the latest (v2)", JSON.stringify((await state(tabB)).graph) === JSON.stringify(v2Graph));
  await tabB.getByTestId("design-name").fill("Flash sale sketch (B)");
  await tabB.getByTestId("save-design").click();
  await waitState(() => window.__designState?.baseVersion === 3 && window.__designState.status === "saved", null, tabB);
  check("tab B saves v3", true);
  await tabB.close();

  await page.getByTestId("design-name").fill("Flash sale sketch (A, from v1)");
  await page.getByTestId("save-design").click();
  await page.getByTestId("save-error").waitFor({ timeout: 30000 });
  check("tab A's save is refused: v3 was saved after the version it built on", (await page.getByTestId("save-error").getAttribute("data-conflict")) === "3");
  const { count: afterConflict } = await supabase.from("designs").select("id", { count: "exact", head: true });
  check("the refused save wrote nothing", afterConflict === 3);
  await page.getByTestId("force-save").click();
  await waitState(() => window.__designState?.baseVersion === 4 && window.__designState.status === "saved");
  check("'save mine anyway' creates v4 and URL drops ?v", !page.url().includes("?v="));
  const { data: all } = await supabase.from("designs").select("version, name, graph").eq("design_key", key).order("version");
  check(
    "versions 1–4 are all kept, none overwritten",
    JSON.stringify(all.map((r) => [r.version, r.name])) ===
      JSON.stringify([
        [1, "Flash sale sketch"],
        [2, "Flash sale sketch"],
        [3, "Flash sale sketch (B)"],
        [4, "Flash sale sketch (A, from v1)"],
      ]) && stable(all[3].graph) === stable(v1Graph),
    JSON.stringify(all.map((r) => [r.version, r.name])),
  );

  // Server-side validation: the action refuses a bad graph even if the UI is bypassed.
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data: anonRows, error: anonErr } = await anon.from("designs").select("id");
  check("anon can't read designs", !!anonErr || anonRows.length === 0, JSON.stringify(anonRows));
  const { error: sizeErr } = await supabase.from("designs").insert({ design_key: key, version: 5, name: "x", graph: [] });
  check("the database refuses a non-object graph written around the app", /designs_graph_object/.test(sizeErr?.message ?? ""), sizeErr?.message);

  // 404s.
  check("unknown design key → 404", (await page.goto(`${BASE}/canvas/00000000-0000-0000-0000-000000000000`)).status() === 404);
  check("malformed key → 404", (await page.goto(`${BASE}/canvas/not-a-key`)).status() === 404);
  check("bad version param → 404", (await page.goto(`${BASE}/canvas/${key}?v=abc`)).status() === 404);
  check("missing version → 404", (await page.goto(`${BASE}/canvas/${key}?v=99`)).status() === 404);
  pageErrors.splice(0, pageErrors.length, ...pageErrors.filter((e) => !e.includes("404")));

  // List and delete.
  await page.goto(BASE + "/canvas");
  const item = page.getByTestId(`design-${key}`);
  check("/canvas lists the design with 4 versions", (await item.innerText()).includes("v4 · 4 versions"));
  await page.screenshot({ path: join(shots, "p5-design-list.png"), fullPage: true });
  await item.getByTestId("delete-design").click();
  await page.getByTestId("no-designs").waitFor({ timeout: 30000 });
  const { count: afterDelete } = await supabase.from("designs").select("id", { count: "exact", head: true });
  check("delete removes every version", afterDelete === 0);

  // Phone width.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/canvas", "/canvas/new"]) {
    await page.goto(BASE + path);
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    check(`${path} has no sideways scroll at 390px`, sw <= iw + 1, `scrollWidth=${sw} innerWidth=${iw}`);
  }
  await page.getByTestId("palette-cache").click();
  await waitState(() => window.__designState?.graph.nodes.length === 1);
  check("click-to-add works at phone width", true);
  await page.screenshot({ path: join(shots, "p5-phone.png"), fullPage: true });

  check("no page errors", pageErrors.length === 0, pageErrors.join("\n"));
} catch (e) {
  const dump = await page
    .evaluate(() => {
      const s = window.__designState;
      return s && { status: s.status, baseVersion: s.baseVersion, dirty: s.dirty, nodes: s.graph.nodes.length, edges: s.graph.edges.map((x) => `${x.id}:${x.kind}`), error: document.querySelector('[data-testid="save-error"]')?.textContent };
    })
    .catch(() => null);
  check("run completed", false, `${e.stack ?? e}\n--- design state ---\n${JSON.stringify(dump)}\n--- page errors ---\n${pageErrors.join("\n")}\n--- server log (tail) ---\n${serverLog.slice(-3000)}`);
} finally {
  await ctx.close();
  server.kill();
}
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
