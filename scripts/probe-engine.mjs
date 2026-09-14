// Empirically compares the browser engine (run in Node via the identical worker
// code) against the local Go toolchain for every program in engine/probes/,
// plus limit probes that need special handling. Writes
// docs/evidence/gc-wasm-probe-results.json; docs/execution-engine.md cites it.
//
//   node scripts/probe-engine.mjs           all probes
//   node scripts/probe-engine.mjs 13 17     only probes whose name starts with 13 or 17
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NodeExecutor } from "./engine-node.mjs";
import { goVersion, normalizeOutput, runRealGo } from "./real-go.mjs";

const root = resolve(import.meta.dirname, "..");
const dir = join(root, "engine", "probes");
const filter = process.argv.slice(2);
const wanted = (name) => filter.length === 0 || filter.some((p) => name.startsWith(p));

const ex = new NodeExecutor();
const ready = await ex.ready();
console.log(`engine ready: ${ready.coldStartMs} ms cold start (toolchain init ${ready.initMs} ms), ${ready.packages.length} importable packages`);

const results = [];
const flag = (b) => (b ? "ok " : "XX ");

async function probe(name, source, opts = {}) {
  const real = runRealGo(source, { lang: opts.lang, gcflags: opts.gcflags, buildOnly: opts.buildOnly });
  const eng = await ex.run([{ name: "main.go", content: source }], { timeoutMs: opts.timeoutMs ?? 10000, lang: opts.lang, gcflags: opts.gcflags });
  const engStderr = opts.buildOnly ? eng.compileOutput : eng.stderr;
  const r = {
    probe: name,
    opts,
    stdoutMatch: opts.buildOnly ? true : real.stdout === eng.stdout,
    exitMatch: opts.buildOnly ? true : real.exitCode === eng.exitCode,
    stderrMatch: normalizeOutput(real.stderr) === normalizeOutput(engStderr),
    stderrFirstLineMatch: normalizeOutput(real.stderr).split("\n")[0] === normalizeOutput(engStderr).split("\n")[0],
    real,
    engine: eng,
  };
  results.push(r);
  console.log(`${flag(r.stdoutMatch)}${flag(r.exitMatch)}${flag(r.stderrMatch)} ${name}  [${eng.status}] compile ${eng.compileMs} ms, link ${eng.linkMs} ms, run ${eng.runMs} ms`);
  if (!r.stdoutMatch || !r.exitMatch || !r.stderrMatch) {
    console.log(`   real exit=${real.exitCode} stdout=${JSON.stringify(real.stdout)}\n        stderr=${JSON.stringify(normalizeOutput(real.stderr).slice(0, 400))}`);
    console.log(`   wasm exit=${eng.exitCode} stdout=${JSON.stringify(eng.stdout)}\n        stderr=${JSON.stringify(normalizeOutput(engStderr).slice(0, 400))}`);
  }
  return r;
}

for (const file of readdirSync(dir).filter((f) => f.endsWith(".go") && wanted(f)).sort()) {
  await probe(file, readFileSync(join(dir, file), "utf8"));
}

// --- special probes ---------------------------------------------------------
const special = (name) => wanted(name);
const src = (name) => readFileSync(join(dir, name), "utf8");

if (special("S1")) {
  // Loop variable semantics follow the go.mod go directive (-lang).
  await probe("S1_loopvar_lang_go1.21", src("17_loopvar_122.go"), { lang: "go1.21" });
}
if (special("S2")) {
  // Escape analysis diagnostics from the real compiler.
  const esc = `package main

import "fmt"

type point struct{ x, y int }

func newPoint() *point {
	p := point{1, 2}
	return &p
}

func sum(xs []int) int {
	t := 0
	for _, x := range xs {
		t += x
	}
	return t
}

func main() {
	p := newPoint()
	local := [3]int{1, 2, 3}
	fmt.Println(p.x, sum(local[:]))
}
`;
  await probe("S2_escape_analysis_-m", esc, { gcflags: ["-m"], buildOnly: true });
}
if (special("S3")) {
  const t0 = performance.now();
  const r = await ex.run([{ name: "main.go", content: "package main\n\nfunc main() {\n\tfor {\n\t}\n}\n" }], { timeoutMs: 2000 });
  const after = await ex.run([{ name: "main.go", content: 'package main\n\nimport "fmt"\n\nfunc main() { fmt.Println("alive") }\n' }], { timeoutMs: 5000 });
  const ok = r.status === "timeout" && after.stdout === "alive\n";
  console.log(`${flag(ok)} S3_infinite_loop_timeout  status=${r.status} after ${Math.round(performance.now() - t0)} ms; next run after respawn: ${JSON.stringify(after.stdout)} (${after.totalMs} ms incl. respawn)`);
  results.push({ probe: "S3_infinite_loop_timeout", pass: ok, engine: r, followUp: after });
}
if (special("S4")) {
  const r = await ex.run([{ name: "main.go", content: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfor i := 0; ; i++ {\n\t\tfmt.Println("spam", i)\n\t}\n}\n' }], { timeoutMs: 10000 });
  const ok = r.status === "output_limit";
  console.log(`${flag(ok)} S4_output_flood  status=${r.status} captured ${r.stdout.length} chars`);
  results.push({ probe: "S4_output_flood", pass: ok, engine: { ...r, stdout: r.stdout.slice(0, 200) } });
}
if (special("S5")) {
  const r = await ex.run([{ name: "main.go", content: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar keep [][]byte\n\tfor i := 0; ; i++ {\n\t\tkeep = append(keep, make([]byte, 64<<20))\n\t\tif i%8 == 0 {\n\t\t\tfmt.Println("allocated MB:", (i+1)*64)\n\t\t}\n\t}\n}\n' }], { timeoutMs: 30000 });
  console.log(`-- S5_memory_exhaustion  status=${r.status} exit=${r.exitCode} stdout tail=${JSON.stringify(r.stdout.slice(-60))} stderr head=${JSON.stringify(r.stderr.slice(0, 120))}`);
  results.push({ probe: "S5_memory_exhaustion", engine: { ...r, stderr: r.stderr.slice(0, 2000) } });
}
if (special("S6")) {
  // Stack overflow: real Go reports "goroutine stack exceeds 1000000000-byte limit".
  const so = "package main\n\nfunc f(n int) int { return f(n+1) + 1 }\n\nfunc main() {\n\tprintln(f(0))\n}\n";
  await probe("S6_stack_overflow", so, { timeoutMs: 60000 });
}
if (special("S8")) {
  // Largest recursion depth the engine survives (V8 wasm stack), vs native Go.
  const depths = [1e3, 1e4, 5e4, 1e5, 1e6];
  const survived = [];
  for (const d of depths) {
    const prog = `package main\n\nimport "fmt"\n\n//go:noinline\nfunc f(n int) int {\n\tif n == 0 {\n\t\treturn 0\n\t}\n\treturn f(n-1) + 1\n}\n\nfunc main() { fmt.Println(f(${d})) }\n`;
    const r = await ex.run([{ name: "main.go", content: prog }], { timeoutMs: 30000 });
    survived.push(`${d}:${r.status === "ok" ? "ok" : "crash"}`);
  }
  console.log(`-- S8_recursion_depth ${survived.join(" ")}`);
  results.push({ probe: "S8_recursion_depth", survived });
}
if (special("S7")) {
  // Warm repeat: how long a second identical run takes once modules are hot.
  const hello = src("01_hello.go");
  const times = [];
  for (let i = 0; i < 3; i++) times.push((await ex.run([{ name: "main.go", content: hello }], { timeoutMs: 5000 })).totalMs);
  console.log(`-- S7_warm_hello_total_ms ${times.join(", ")}`);
  results.push({ probe: "S7_warm_hello_total_ms", times });
}

if (filter.length === 0) {
  writeFileSync(
    join(root, "docs", "evidence", "gc-wasm-probe-results.json"),
    JSON.stringify({ goVersion: goVersion(), platform: `node ${process.version} ${process.platform}`, ready: { coldStartMs: ready.coldStartMs, initMs: ready.initMs, packageCount: ready.packages.length }, results }, null, 2) + "\n",
  );
}
await ex.close();
