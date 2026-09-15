// Content pipeline (spec §8). For every lesson in content/go/<module>/<lesson>/:
//   1. collects verified Go: trap.go, rebuild.go, rebuild/solution.go, and
//      every ```go verified id=…``` fence in lesson.md
//   2. runs each with the local Go toolchain
//   3. runs each through the browser engine (same worker code, via Node) and
//      flags divergence, which must be declared in the lesson
//   4. runs the challenge table tests against the starter, the reference
//      solution and every wrong solution, with `go test -v` and with the
//      engine harness, and requires identical per-case results
//   5. compares everything with the committed expected.json and fails on any
//      difference (or writes it with --update)
//
// Lesson parsing, output comparison and the test harness come from
// src/lib/content/{lesson,harness}.ts, the same code the lesson player runs.
//
//   node scripts/verify-content.mjs                 verify all lessons
//   node scripts/verify-content.mjs --update        regenerate expected.json
//   node scripts/verify-content.mjs slicing nil     only lessons whose slug contains a filter
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildHarness, HARNESS_FILE, LEARNER_FILE, parseTestOutput, TESTS_FILE } from "../src/lib/content/harness.ts";
import { changedLockedLines, normalizeForCompare, observedOutput, parseLessonMd, SECTION_NAMES } from "../src/lib/content/lesson.ts";
import { NodeExecutor } from "./engine-node.mjs";
import { goVersion, normalizeOutput } from "./real-go.mjs";

const root = resolve(import.meta.dirname, "..");
const contentDir = join(root, "content", "go");

const GO = goVersion();
const LANG_DEFAULT = GO.split(".").slice(0, 2).join(".");
const NONDETERMINISTIC_RUNS = 5;

// ---------------------------------------------------------------- runners ---

const GOENV = { ...process.env, GOFLAGS: "-mod=mod", GOTOOLCHAIN: "local" };

/**
 * `go run` / `go build` / `go test` over files in a temp module. testArgs
 * replaces the default `-v` for test mode (e.g. `-run=^$ -bench=.`).
 */
export function realGo(files, { mode = "run", lang, gcflags, testArgs, timeoutMs = 120000 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "goforge-"));
  try {
    writeFileSync(join(dir, "go.mod"), `module prog\n\ngo ${(lang ?? LANG_DEFAULT).replace(/^go/, "")}\n`);
    for (const f of files) writeFileSync(join(dir, f.name), f.content);
    const args = mode === "build" ? ["build", "-o", join(dir, "prog.exe")] : mode === "test" ? ["test", "-count=1", ...(testArgs ?? ["-v"])] : ["run"];
    if (gcflags) args.push(`-gcflags=${gcflags.join(" ")}`);
    args.push(".");
    const res = spawnSync("go", args, { cwd: dir, encoding: "utf8", timeout: timeoutMs, killSignal: "SIGKILL", env: GOENV });
    if (res.error?.code === "ETIMEDOUT") throw new Error(`go ${mode} timed out`);
    let stderr = res.stderr ?? "";
    let exitCode = res.status ?? -1;
    // `go run` exits 1 for any failing program and appends "exit status N".
    const m = stderr.match(/exit status (\d+)\r?\n$/);
    if (mode === "run" && m) {
      exitCode = Number(m[1]);
      stderr = stderr.slice(0, m.index);
    }
    return { stdout: norm(res.stdout ?? ""), stderr: norm(stderr), exitCode };
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

/** normalizeOutput, plus Windows-relative paths for any file and the `go test` build-failure header. */
export function norm(s) {
  return normalizeOutput(s)
    .replace(/^# prog \[prog\.test\]\n/m, "")
    .replace(/\.\\([\w.-]+\.go)/g, "./$1")
    .replace(/[A-Za-z]:[\\/][^\s:]*?[\\/]goforge-[^\\/\s]+[\\/]([\w.-]+\.go)/g, "$1");
}

/**
 * compare=shape: output whose numbers legitimately change between runs
 * (benchmark timings, fuzzing progress, test durations, worker counts). Only
 * those parts are replaced; everything else must match exactly, and the block
 * is run twice to prove the shape is stable.
 */
export function shapeOf(s) {
  return s
    .split("\n")
    .filter((l) => !/^fuzz: /.test(l))
    .map((l) =>
      l
        // Benchmark columns are padded to the width of the numbers, so the
        // spacing changes with them too: one space between fields.
        .replace(/^(Benchmark\S+?)(?:-\d+)?\s+\d+\s+[\d.]+ ns\/op(.*)$/, (_, name, rest) => `${name}-P N N ns/op${rest.replace(/\s+/g, " ")}`)
        .replace(/^cpu: .*$/, "cpu: <this machine>")
        .replace(/^goos: \S+$/, "goos: <os>")
        .replace(/\(\d+\.\d+s\)/g, "(N.NNs)")
        .replace(/^(ok|FAIL)(\s+)prog(\s+)\d+\.\d+s$/, "$1$2prog$3N.NNNs")
        .replace(/testdata(?:[\\/][\w.-]+)+/g, (p) => p.replaceAll("\\", "/")),
    )
    .join("\n");
}

let engine;
async function engineGo(files, { mode = "run", lang, gcflags, timeoutMs = 15000 } = {}) {
  engine ??= new NodeExecutor();
  const r = await engine.run(files, { timeoutMs, lang, gcflags });
  if (r.status === "engine_error") throw new Error(`engine error: ${r.engineError}`);
  if (r.status === "timeout" || r.status === "output_limit") throw new Error(`engine ${r.status}`);
  if (mode === "build") return { stdout: "", stderr: norm(r.compileOutput), exitCode: r.status === "compile_error" ? 1 : 0, status: r.status };
  return { stdout: norm(r.stdout), stderr: norm(r.stderr), exitCode: r.exitCode, status: r.status };
}

function shape(s, compare) {
  return compare === "sorted-lines" ? s.split("\n").filter(Boolean).sort().join("\n") : s;
}

function sameResult(a, b, compare = "exact") {
  return shape(a.stdout, compare) === shape(b.stdout, compare) && shape(a.stderr, compare) === shape(b.stderr, compare) && a.exitCode === b.exitCode;
}

// --------------------------------------------------------------- blocks ---

async function runProgram(id, code, meta, lang, errs) {
  const mode = meta.mode ?? "run";
  if (!["run", "build", "local"].includes(mode)) errs.push(`${id}: mode must be run|build|local`);
  if (meta.nondeterministic && meta.nondeterministic !== "sorted-lines") errs.push(`${id}: nondeterministic must be "sorted-lines"`);
  if (mode === "local" && typeof meta.reason !== "string") errs.push(`${id}: mode=local needs reason=<why the browser can't run it>`);
  const cmd = meta.cmd ?? "run";
  if (!["run", "test"].includes(cmd)) errs.push(`${id}: cmd must be run|test`);
  if (cmd === "test" && mode !== "local") errs.push(`${id}: cmd=test is only for mode=local blocks (the browser has no go test)`);
  if (meta.compare !== undefined && meta.compare !== "shape") errs.push(`${id}: compare must be "shape"`);
  if (meta.compare === "shape" && mode !== "local") errs.push(`${id}: compare=shape is only for mode=local blocks`);
  const compare = meta.nondeterministic === "sorted-lines" ? "sorted-lines" : meta.compare === "shape" ? "shape" : "exact";
  const testArgs = cmd === "test" ? (typeof meta.args === "string" ? meta.args.split(",") : ["-v"]) : undefined;
  const opts = {
    mode: cmd === "test" ? "test" : mode === "build" ? "build" : "run",
    lang: typeof meta.lang === "string" ? meta.lang : lang,
    gcflags: typeof meta.gcflags === "string" ? meta.gcflags.split(",") : undefined,
    testArgs,
    timeoutMs: 180000,
  };
  const files = [{ name: cmd === "test" ? "main_test.go" : "main.go", content: code }];

  const real = realGo(files, opts);
  const block = { mode, compare };
  if (cmd === "test") {
    block.cmd = "test";
    block.args = testArgs;
  }
  if (opts.lang) block.lang = opts.lang;
  if (opts.gcflags) block.gcflags = opts.gcflags;
  if (compare === "shape") {
    real.stdout = shapeOf(real.stdout);
    real.stderr = shapeOf(real.stderr);
    const again = realGo(files, opts);
    again.stdout = shapeOf(again.stdout);
    again.stderr = shapeOf(again.stderr);
    if (!sameResult(real, again)) errs.push(`${id}: output shape differs between two runs; not a stable property\n    run 1: ${JSON.stringify(real).slice(0, 600)}\n    run 2: ${JSON.stringify(again).slice(0, 600)}`);
  }
  if (compare === "sorted-lines") {
    const seen = new Set([real.stdout]);
    for (let i = 1; i < NONDETERMINISTIC_RUNS; i++) {
      const again = realGo(files, opts);
      if (!sameResult(real, again, compare)) errs.push(`${id}: output differs between runs even as sorted lines; not a valid property`);
      seen.add(again.stdout);
    }
    // Record the order-free form so expected.json is stable.
    real.stdout = shape(real.stdout, compare) + (real.stdout ? "\n" : "");
    block.variedAcrossRuns = seen.size > 1;
  }
  block.real = real;
  block.diverges = false;
  if (mode !== "local") {
    const eng = await engineGo(files, opts);
    if (compare === "sorted-lines") eng.stdout = shape(eng.stdout, compare) + (eng.stdout ? "\n" : "");
    block.engine = eng;
    block.diverges = !sameResult(real, eng, compare);
    if (block.diverges && !meta.diverges) errs.push(`${id}: engine output differs from real Go and the block is not marked "diverges"\n    real:   ${JSON.stringify(real)}\n    engine: ${JSON.stringify(eng)}`);
    if (!block.diverges && meta.diverges) errs.push(`${id}: marked "diverges" but the engine matches real Go; remove the marker`);
  }
  return block;
}

// ------------------------------------------------------------ challenges ---

async function runSubmission(label, source, tests, harness, lang, errs) {
  const files = [
    { name: LEARNER_FILE, content: source },
    { name: TESTS_FILE, content: tests },
  ];
  const real = realGo(files, { mode: "test", lang });
  const realReport = parseTestOutput(real.stdout, real.exitCode);
  const eng = await engineGo([...files, { name: HARNESS_FILE, content: harness }], { lang });
  const engReport = parseTestOutput(eng.stdout, eng.exitCode);
  const statuses = (r) => Object.fromEntries(r.cases.map((c) => [c.name, c.status]));
  if (realReport.passed !== engReport.passed || JSON.stringify(statuses(realReport)) !== JSON.stringify(statuses(engReport))) {
    errs.push(`challenge ${label}: engine per-case results differ from go test -v\n    real:   ${JSON.stringify(statuses(realReport))}\n    engine: ${JSON.stringify(statuses(engReport))} ${eng.stderr.slice(0, 300)}`);
  }
  const noCases = realReport.cases.length === 0;
  return { result: { passed: realReport.passed, cases: statuses(realReport) }, noCases, detail: (real.stderr || real.stdout).trim() };
}

async function runChallenge(dir, fm, errs) {
  const cdir = join(dir, "challenge");
  const need = ["starter.go", "solution.go", TESTS_FILE].filter((f) => !existsSync(join(cdir, f)));
  if (need.length) {
    errs.push(`challenge/ missing ${need.join(", ")}`);
    return null;
  }
  if (fm.challenge.entry !== "starter.go") errs.push(`challenge.entry must be "starter.go"`);
  const tests = readFileSync(join(cdir, TESTS_FILE), "utf8");
  const harness = buildHarness([tests]);
  const lang = fm.lang;

  const solution = await runSubmission("solution", readFileSync(join(cdir, "solution.go"), "utf8"), tests, harness, lang, errs);
  if (!solution.result.passed) errs.push(`challenge: reference solution does not pass\n    ${solution.detail.split("\n").slice(0, 8).join("\n    ")}`);
  const starter = await runSubmission("starter", readFileSync(join(cdir, "starter.go"), "utf8"), tests, harness, lang, errs);
  // A starter may fail to compile when that is the lesson.
  if (starter.result.passed) errs.push("challenge: starter already passes");

  const wrongDir = join(cdir, "wrong");
  const wrongFiles = existsSync(wrongDir) ? readdirSync(wrongDir).filter((f) => f.endsWith(".go")).sort() : [];
  if (wrongFiles.length === 0) errs.push("challenge/wrong/ needs at least one wrong solution");
  const wrong = {};
  for (const f of wrongFiles) {
    const w = await runSubmission(`wrong/${f}`, readFileSync(join(wrongDir, f), "utf8"), tests, harness, lang, errs);
    wrong[f] = w.result;
    if (w.result.passed) errs.push(`challenge: wrong/${f} passes the tests; the tests are too weak`);
    // A wrong solution that doesn't compile proves nothing about the tests.
    if (w.noCases) errs.push(`challenge: wrong/${f} must compile and fail on test cases, not with:\n    ${w.detail.split("\n").slice(0, 4).join("\n    ")}`);
  }
  return { tests: Object.keys(solution.result.cases), solution: solution.result, starter: starter.result, wrong };
}

// ---------------------------------------------------------------- checks ---

export function checkMarkdown(body, errs) {
  // The lesson renderer supports paragraphs, emphasis, code, links, lists,
  // fences and blockquotes. Tables and raw HTML would show up as literal text.
  const outsideFences = body.replace(/^```[^\n]*\n[\s\S]*?^```$/gm, "");
  if (/^\s*\|.*\|\s*$/m.test(outsideFences)) errs.push("lesson.md uses a markdown table; the renderer has no tables, use a list");
  if (/<\/?[a-z][a-z0-9]*[\s>]/i.test(outsideFences.replace(/`[^`\n]*`/g, ""))) errs.push("lesson.md contains raw HTML; the renderer does not support it");
}

function checkGofmt(dir, errs) {
  const res = spawnSync("gofmt", ["-l", dir], { encoding: "utf8" });
  // Files that don't parse (compile-error lessons) are reported on stderr, not listed; that is intended.
  const files = (res.stdout ?? "").split(/\r?\n/).filter(Boolean);
  if (files.length) errs.push(`not gofmt-clean: ${files.join(", ")}`);
}

export function checkTrap(fm, trap, errs) {
  const observed = observedOutput(trap.real);
  if (trap.compare !== "exact") errs.push("trap.go must be deterministic: learners predict exact output");
  if (fm.trap.kind === "choice") {
    const chosen = normalizeForCompare(fm.trap.choices[fm.trap.answer]);
    if (chosen !== observed) errs.push(`trap answer ${JSON.stringify(chosen)} != verified output ${JSON.stringify(observed)}`);
    const matching = fm.trap.choices.filter((c) => normalizeForCompare(c) === observed).length;
    if (matching !== 1) errs.push(`exactly one trap choice must match the verified output (found ${matching})`);
  } else if (normalizeForCompare(String(fm.trap.answer)) !== observed) {
    errs.push(`trap text answer ${JSON.stringify(fm.trap.answer)} != verified output ${JSON.stringify(observed)}`);
  }
}

// ------------------------------------------------------------------ main ---

async function verifyLesson(moduleSlug, lessonSlug, trackLesson) {
  const dir = join(contentDir, moduleSlug, lessonSlug);
  const errs = [];
  const read = (...p) => readFileSync(join(dir, ...p), "utf8");

  let lesson;
  try {
    lesson = parseLessonMd(read("lesson.md"));
  } catch (e) {
    return { errs: [e.message] };
  }
  const fm = lesson.frontmatter;
  if (fm.slug !== lessonSlug) errs.push(`slug "${fm.slug}" != directory "${lessonSlug}"`);
  if (!trackLesson) errs.push(`lesson "${lessonSlug}" is not listed under ${moduleSlug} in track.json`);
  else {
    if (fm.title !== trackLesson.title) errs.push(`title ${JSON.stringify(fm.title)} != track.json ${JSON.stringify(trackLesson.title)}`);
    if (JSON.stringify(fm.concepts) !== JSON.stringify(trackLesson.concepts)) errs.push(`concepts ${JSON.stringify(fm.concepts)} != track.json ${JSON.stringify(trackLesson.concepts)}`);
    if (JSON.stringify(fm.requires) !== JSON.stringify(trackLesson.requires)) errs.push(`requires ${JSON.stringify(fm.requires)} != track.json ${JSON.stringify(trackLesson.requires)}`);
  }
  const missing = SECTION_NAMES.filter((s) => !lesson.sections[s]);
  if (missing.length) errs.push(`missing or empty sections: ${missing.join(", ")}`);
  checkMarkdown(read("lesson.md").replace(/^---\n[\s\S]*?\n---\n/, ""), errs);
  checkGofmt(dir, errs);

  if (!existsSync(join(dir, "hints.json"))) errs.push("missing hints.json");
  else {
    const hints = JSON.parse(read("hints.json"));
    if (!Array.isArray(hints) || hints.length !== 2 || hints.some((h) => typeof h !== "string" || !h.trim())) errs.push(`hints.json must be ["hint1", "hint2"]`);
  }

  const blocks = {};
  const fileMeta = (name) => lesson.fences.find((f) => f.lang === "go" && f.meta.file === name)?.meta ?? {};
  for (const [id, rel] of [["trap", "trap.go"], ["rebuild", "rebuild.go"], ["rebuild-solution", "rebuild/solution.go"]]) {
    if (!existsSync(join(dir, rel))) errs.push(`missing ${rel}`);
    else blocks[id] = await runProgram(id, read(rel), fileMeta(rel), fm.lang, errs).catch((e) => errs.push(`${id}: ${e.message}`));
  }
  for (const f of lesson.fences.filter((f) => f.lang === "go")) {
    if (f.meta.file) {
      if (!existsSync(join(dir, f.meta.file))) errs.push(`fence file=${f.meta.file} does not exist`);
      else if (f.code.trim() && f.code !== read(f.meta.file)) errs.push(`fence file=${f.meta.file}: body differs from the file; leave it empty`);
    } else if (f.meta.excerpt) {
      // A fragment quoted from a verified file: every line must appear there.
      const p = join(dir, String(f.meta.excerpt));
      const lines = existsSync(p) ? new Set(readFileSync(p, "utf8").replace(/\r\n/g, "\n").split("\n").map((l) => l.trim())) : null;
      if (!lines) errs.push(`fence excerpt=${f.meta.excerpt} does not exist`);
      else for (const l of f.code.split("\n").map((l) => l.trim()).filter(Boolean)) if (!lines.has(l)) errs.push(`fence excerpt=${f.meta.excerpt}: line not in file: ${JSON.stringify(l)}`);
    } else if (!f.meta.verified) {
      errs.push(`go fence without verified/file=/excerpt=: every Go snippet must be verified (starts ${JSON.stringify(f.code.split("\n")[0])})`);
    } else if (typeof f.meta.id !== "string") {
      errs.push(`verified fence needs id= (starts ${JSON.stringify(f.code.split("\n")[0])})`);
    } else if (blocks[f.meta.id]) {
      errs.push(`duplicate block id ${f.meta.id}`);
    } else {
      blocks[f.meta.id] = await runProgram(f.meta.id, f.code, f.meta, fm.lang, errs).catch((e) => errs.push(`${f.meta.id}: ${e.message}`));
    }
  }
  if (Object.values(blocks).some((b) => b?.diverges) && !/^\*\*Engine note:\*\*/m.test(read("lesson.md"))) {
    errs.push(`a block diverges from real Go; lesson.md must disclose it in a paragraph starting "**Engine note:**"`);
  }

  if (blocks.trap?.real) checkTrap(fm, blocks.trap, errs);
  const rb = blocks.rebuild?.real, rs = blocks["rebuild-solution"]?.real;
  if (rb && rs) {
    const changed = changedLockedLines(read("rebuild.go"), read("rebuild", "solution.go"), fm.rebuild.lockedLines);
    if (changed.length) errs.push(`rebuild/solution.go changes locked lines ${changed.join(", ")}`);
    for (const n of fm.rebuild.lockedLines ?? []) if (!(read("rebuild.go").replace(/\r\n/g, "\n").split("\n")[n - 1] ?? "").trim()) errs.push(`rebuild.lockedLines: line ${n} is blank or out of range`);
    if (rs.exitCode !== 0) errs.push("rebuild/solution.go must exit 0");
    if (normalizeForCompare(rb.stdout) === normalizeForCompare(rs.stdout)) errs.push("rebuild.go already prints the goal output; the rebuild task is trivial");
  }

  let challenge = null;
  try {
    challenge = await runChallenge(dir, fm, errs);
  } catch (e) {
    errs.push(`challenge: ${e.message}`);
  }

  // Same layout as scripts/verify-lesson.mjs wrote for the P2 lesson.
  const expected = { goVersion: GO, blocks, challenge, rebuild: { expectedStdout: rs?.stdout ?? null, lockedLines: fm.rebuild.lockedLines ?? [] } };
  return { errs, expected, dir };
}

function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v;
}

function diffPaths(a, b, path = "", out = []) {
  if (JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))) return out;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      // Informational only: whether the order happened to change in this
      // run's 5 samples. A small map can repeat its order by chance, so it
      // isn't something a later run can be held to.
      if (k === "variedAcrossRuns") continue;
      diffPaths(a[k], b[k], `${path}.${k}`, out);
    }
  } else out.push(`${path || "."}: committed ${JSON.stringify(a)?.slice(0, 200)} | actual ${JSON.stringify(b)?.slice(0, 200)}`);
  return out;
}

export async function main(argv) {
  const update = argv.includes("--update");
  const filters = argv.filter((a) => !a.startsWith("--"));
  const track = JSON.parse(readFileSync(join(contentDir, "track.json"), "utf8"));
  const lessons = [];
  for (const m of track.modules) {
    const mdir = join(contentDir, m.slug);
    if (!existsSync(mdir)) continue;
    for (const d of readdirSync(mdir).sort((x, y) => m.lessons.findIndex((l) => l.slug === x) - m.lessons.findIndex((l) => l.slug === y))) {
      if (!statSync(join(mdir, d)).isDirectory()) continue;
      if (filters.length && !filters.some((f) => d.includes(f))) continue;
      lessons.push([m.slug, d, m.lessons.find((l) => l.slug === d)]);
    }
  }
  console.log(`verify-content: ${lessons.length} lesson(s), ${GO}${update ? ", writing expected.json" : ""}`);
  let bad = 0;
  for (const [m, l, t] of lessons) {
    const t0 = performance.now();
    const { errs, expected, dir } = await verifyLesson(m, l, t);
    if (expected && errs.length === 0) {
      const path = join(dir, "expected.json");
      if (update) writeFileSync(path, JSON.stringify(expected, null, 2) + "\n");
      else if (!existsSync(path)) errs.push("expected.json missing (run with --update)");
      else {
        const diffs = diffPaths(JSON.parse(readFileSync(path, "utf8")), JSON.parse(JSON.stringify(expected)));
        if (diffs.length) errs.push(`actual output differs from committed expected.json:\n    ${diffs.slice(0, 10).join("\n    ")}`);
      }
    }
    const s = ((performance.now() - t0) / 1000).toFixed(1);
    if (errs.length) {
      bad++;
      console.log(`FAIL ${m}/${l} (${s}s)`);
      for (const e of errs) console.log(`  - ${e}`);
    } else console.log(`ok   ${m}/${l} (${s}s)`);
  }
  await engine?.close();
  engine = undefined;
  console.log(bad ? `\n${bad} of ${lessons.length} lesson(s) failed` : `\nall ${lessons.length} lesson(s) verified`);
  return bad;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  process.exit((await main(process.argv.slice(2))) ? 1 : 0);
}
