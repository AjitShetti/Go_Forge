// Verifies one lesson against the real Go toolchain AND the browser engine, and
// writes the lesson's expected.json. Fails (exit 1) on any mismatch.
//
//   node scripts/verify-lesson.mjs content/go/m3-slices-maps/slice-aliasing
//
// This is the P2 single-lesson verifier. The P3 content pipeline
// (scripts/verify-content.mjs) generalizes it to every lesson and supersedes it.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { buildHarness, HARNESS_FILE, LEARNER_FILE, parseTestOutput, TESTS_FILE } from "../src/lib/content/harness.ts";
import { changedLockedLines, normalizeForCompare, observedOutput, parseLessonMd } from "../src/lib/content/lesson.ts";
import { NodeExecutor } from "./engine-node.mjs";
import { goVersion, normalizeOutput, runRealGo, runRealGoTest } from "./real-go.mjs";

const dir = resolve(process.argv[2] ?? "");
if (!existsSync(join(dir, "lesson.md"))) {
  console.error("usage: node scripts/verify-lesson.mjs <lesson dir>");
  process.exit(2);
}
const read = (...p) => readFileSync(join(dir, ...p), "utf8");
const lesson = parseLessonMd(read("lesson.md"));
const fm = lesson.frontmatter;
const lang = fm.lang;

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail && !ok ? "\n      " + detail : ""}`);
};

const ex = new NodeExecutor();
await ex.ready();
const expected = { goVersion: goVersion(), blocks: {}, challenge: {} };

async function verifyProgram(id, source) {
  const real = runRealGo(source, { lang });
  const engine = await ex.run([{ name: "main.go", content: source }], { timeoutMs: 10000, lang });
  const same = real.stdout === engine.stdout && real.exitCode === engine.exitCode && normalizeOutput(real.stderr) === normalizeOutput(engine.stderr);
  check(`[${id}] engine output identical to go run`, same, `real=${JSON.stringify(real)}\n      engine=${JSON.stringify({ stdout: engine.stdout, stderr: engine.stderr, exitCode: engine.exitCode })}`);
  expected.blocks[id] = {
    mode: "run",
    compare: "exact",
    real: { stdout: real.stdout, stderr: normalizeOutput(real.stderr), exitCode: real.exitCode },
    engine: { stdout: engine.stdout, stderr: normalizeOutput(engine.stderr), exitCode: engine.exitCode, status: engine.status },
    diverges: !same,
  };
  return real;
}

// --- trap ---------------------------------------------------------------------
const trap = await verifyProgram("trap", read("trap.go"));
const trapObserved = observedOutput(trap);
if (fm.trap.kind === "choice") {
  check("trap answer choice equals verified output", normalizeForCompare(fm.trap.choices[fm.trap.answer]) === trapObserved, `choice=${JSON.stringify(fm.trap.choices[fm.trap.answer])} observed=${JSON.stringify(trapObserved)}`);
  const matching = fm.trap.choices.filter((c) => normalizeForCompare(c) === trapObserved).length;
  check("exactly one choice matches the verified output", matching === 1, `matching=${matching}`);
} else {
  check("trap answer text equals verified output", normalizeForCompare(String(fm.trap.answer)) === trapObserved);
}

// --- rebuild ------------------------------------------------------------------
const rebuildSrc = read("rebuild.go");
const rebuild = await verifyProgram("rebuild", rebuildSrc);
const solutionSrc = read("rebuild", "solution.go");
const rebuildSolution = await verifyProgram("rebuild-solution", solutionSrc);
check("rebuild solution keeps locked lines", changedLockedLines(rebuildSrc, solutionSrc, fm.rebuild.lockedLines).length === 0);
check("rebuild starter does not already meet the goal", normalizeForCompare(rebuild.stdout) !== normalizeForCompare(rebuildSolution.stdout));
check("rebuild solution exits 0", rebuildSolution.exitCode === 0);
expected.rebuild = { expectedStdout: rebuildSolution.stdout, lockedLines: fm.rebuild.lockedLines ?? [] };

// --- inline verified blocks --------------------------------------------------
for (const fence of lesson.fences.filter((f) => f.lang === "go" && f.meta.verified)) {
  if (typeof fence.meta.id !== "string") {
    check("verified fence has an id", false, fence.code.slice(0, 80));
    continue;
  }
  await verifyProgram(fence.meta.id, fence.code);
}

// --- challenge -------------------------------------------------------------------
const tests = read("challenge", TESTS_FILE);
const harness = buildHarness([tests]);
async function verifySubmission(label, source) {
  const real = runRealGoTest([{ name: LEARNER_FILE, content: source }, { name: TESTS_FILE, content: tests }], { lang });
  const realReport = parseTestOutput(real.stdout, real.exitCode);
  const eng = await ex.run(
    [
      { name: LEARNER_FILE, content: source },
      { name: TESTS_FILE, content: tests },
      { name: HARNESS_FILE, content: harness },
    ],
    { timeoutMs: 10000, lang },
  );
  const engReport = parseTestOutput(eng.stdout, eng.exitCode);
  const statuses = (r) => Object.fromEntries(r.cases.map((c) => [c.name, c.status]));
  const same = JSON.stringify(statuses(realReport)) === JSON.stringify(statuses(engReport)) && realReport.passed === engReport.passed;
  check(`[challenge/${label}] engine per-case results identical to go test -v`, same, `real=${JSON.stringify(statuses(realReport))} engine=${JSON.stringify(statuses(engReport))} engineStatus=${eng.status} ${eng.stderr.slice(0, 300)}`);
  return { passed: realReport.passed, cases: statuses(realReport) };
}

expected.challenge.tests = [...new Set(parseTestOutput(runRealGoTest([{ name: LEARNER_FILE, content: read("challenge", "solution.go") }, { name: TESTS_FILE, content: tests }]).stdout, 0).cases.map((c) => c.name))];
expected.challenge.solution = await verifySubmission("solution", read("challenge", "solution.go"));
check("reference solution passes", expected.challenge.solution.passed);
expected.challenge.starter = await verifySubmission("starter", read("challenge", fm.challenge.entry));
check("starter does not pass", !expected.challenge.starter.passed);
expected.challenge.wrong = {};
const wrongDir = join(dir, "challenge", "wrong");
const wrongFiles = existsSync(wrongDir) ? readdirSync(wrongDir).filter((f) => f.endsWith(".go")) : [];
check("at least one wrong solution exists", wrongFiles.length > 0);
for (const f of wrongFiles) {
  expected.challenge.wrong[basename(f)] = await verifySubmission(`wrong/${f}`, read("challenge", "wrong", f));
  check(`wrong/${f} fails`, !expected.challenge.wrong[basename(f)].passed);
}

// --- hints --------------------------------------------------------------------
const hints = JSON.parse(read("hints.json"));
check("hints.json has exactly 2 hints", Array.isArray(hints) && hints.length === 2);

await ex.close();
if (failures === 0) {
  writeFileSync(join(dir, "expected.json"), JSON.stringify(expected, null, 2) + "\n");
  console.log(`\nALL PASS — wrote ${join(dir, "expected.json")}`);
} else {
  console.log(`\n${failures} FAILED — expected.json not written`);
  process.exit(1);
}
