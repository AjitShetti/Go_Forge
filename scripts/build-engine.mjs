// Builds the in-browser Go engine into public/engine/gen/:
//   compile.<hash>.wasm.gz, link.<hash>.wasm.gz   cmd/compile + cmd/link for js/wasm
//   std-<chunk>.<hash>.pack.gz                    precompiled js/wasm stdlib archives
//   wasm_exec.js                            glue from the SAME toolchain
//   manifest.json                           versions, chunk map, sizes
//
// wasm_exec.js moved from misc/wasm (<= go1.23) to lib/wasm (>= go1.24), so it
// is resolved from `go env GOROOT` at build time, never hardcoded.
//
// The binaries are stored gzipped (about 200 MB raw, a fifth of that gzipped)
// and the engine inflates them itself, so the download stays small on any
// static host, whether or not it compresses responses, and no file comes near
// a host's per-file size limit.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { constants, gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const outDir = join(root, "public", "engine", "gen");
const wasmEnv = { ...process.env, GOOS: "js", GOARCH: "wasm", CGO_ENABLED: "0", GOFLAGS: "-trimpath" };
const go = (args, env = process.env) => execFileSync("go", args, { encoding: "utf8", env, maxBuffer: 1 << 28 }).trim();
const mb = (n) => (n / 1048576).toFixed(1) + " MB";
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
/** Writes `name`.gz and returns its name and gzipped size. The hash in `name` is of the raw bytes. */
const writeGz = (name, bytes) => {
  const gz = gzipSync(bytes, { level: constants.Z_BEST_COMPRESSION });
  writeFileSync(join(outDir, `${name}.gz`), gz);
  return { file: `${name}.gz`, gzSize: gz.length };
};

// Stdlib chunks. Each chunk holds the transitive deps of its roots that are not
// already in an earlier chunk. "core" is fetched at startup; the rest only when
// a program imports one of their packages.
const CHUNK_ROOTS = {
  core: [
    "bufio", "bytes", "cmp", "container/heap", "container/list", "context", "crypto/sha256", "encoding/base64",
    "encoding/binary", "encoding/hex", "encoding/json", "errors", "fmt", "hash/fnv", "io", "io/fs", "iter", "log",
    "maps", "math", "math/bits", "math/rand", "math/rand/v2", "os", "path", "path/filepath", "reflect", "regexp",
    "runtime", "runtime/debug", "slices", "sort", "strconv", "strings", "sync", "sync/atomic", "testing", "text/tabwriter",
    "time", "unicode", "unicode/utf16", "unicode/utf8", "unsafe",
  ],
  net: ["net/http", "net/http/httptest", "net/url", "net/netip", "net/mail"],
  goast: ["go/ast", "go/constant", "go/format", "go/parser", "go/printer", "go/scanner", "go/token", "go/types"],
  rest: ["std"],
};
// syscall/js ships (os and syscall depend on it on js/wasm) but user programs
// may not import it: toolchain.js rejects that import, since it would let user
// code reach fetch() and other worker globals.
const EXCLUDED = /^(cmd\/|plugin$|runtime\/cgo$|runtime\/race|.*\/testdata)/;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const goroot = go(["env", "GOROOT"]);
const goVersion = go(["env", "GOVERSION"]);
const glue = [join(goroot, "lib", "wasm", "wasm_exec.js"), join(goroot, "misc", "wasm", "wasm_exec.js")].find(existsSync);
if (!glue) throw new Error(`wasm_exec.js not found under GOROOT=${goroot}`);
copyFileSync(glue, join(outDir, "wasm_exec.js"));

const manifest = { goVersion, goos: "js", goarch: "wasm", builtAt: new Date().toISOString(), tools: {}, chunks: {}, packages: {}, builtinPackages: [] };
const report = [];

for (const tool of ["compile", "link"]) {
  const tmp = join(outDir, `${tool}.wasm`);
  const t0 = Date.now();
  execFileSync("go", ["build", "-ldflags=-s -w", "-o", tmp, `cmd/${tool}`], { env: wasmEnv, stdio: "inherit" });
  const bytes = readFileSync(tmp);
  const { file, gzSize } = writeGz(`${tool}.${hash(bytes)}.wasm`, bytes);
  rmSync(tmp);
  manifest.tools[tool] = { file, size: bytes.length, gzSize };
  report.push(`${tool.padEnd(8)} ${mb(bytes.length).padStart(9)} raw ${mb(gzSize).padStart(9)} gzip  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

// One `go list` gives every package's export archive and transitive deps.
const info = new Map();
const listed = go(["list", "-deps", "-export", "-f", "{{.ImportPath}}\t{{.Export}}\t{{join .Deps \",\"}}", "std"], wasmEnv);
for (const line of listed.split("\n")) {
  const [pkg, exp, deps] = line.trim().split("\t");
  if (!pkg || EXCLUDED.test(pkg)) continue;
  info.set(pkg, { exp, deps: deps ? deps.split(",") : [] });
}

const chunkOf = new Map();
for (const [chunk, roots] of Object.entries(CHUNK_ROOTS)) {
  const members = roots[0] === "std" ? [...info.keys()] : roots.flatMap((r) => [r, ...(info.get(r)?.deps ?? [])]);
  for (const pkg of members) {
    if (!info.has(pkg)) {
      if (roots.includes(pkg)) throw new Error(`chunk ${chunk}: root ${pkg} not available for js/wasm`);
      continue;
    }
    if (!chunkOf.has(pkg)) chunkOf.set(pkg, chunk);
  }
}

for (const chunk of Object.keys(CHUNK_ROOTS)) {
  const pkgs = [...chunkOf].filter(([, c]) => c === chunk).map(([p]) => p).sort();
  const requires = new Set();
  const files = [];
  const blobs = [];
  let offset = 0;
  for (const pkg of pkgs) {
    const { exp, deps } = info.get(pkg);
    for (const d of deps) {
      const c = chunkOf.get(d);
      if (c && c !== chunk) requires.add(c);
    }
    if (!exp) {
      manifest.builtinPackages.push(pkg); // e.g. unsafe: implemented by the compiler, no archive
      continue;
    }
    const bytes = readFileSync(exp);
    files.push({ path: `${pkg}.a`, offset, size: bytes.length });
    blobs.push(bytes);
    offset += bytes.length;
    manifest.packages[pkg] = chunk;
  }
  const header = Buffer.from(JSON.stringify({ files }));
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(header.length);
  const pack = Buffer.concat([Buffer.from("GFPK"), lenBuf, header, ...blobs]);
  const { file, gzSize } = writeGz(`std-${chunk}.${hash(pack)}.pack`, pack);
  manifest.chunks[chunk] = { file, size: pack.length, gzSize, requires: [...requires].sort(), packageCount: files.length };
  report.push(`std-${chunk.padEnd(4)} ${mb(pack.length).padStart(9)} raw ${mb(gzSize).padStart(9)} gzip  ${files.length} pkgs, requires [${[...requires]}]`);
}

writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`go ${goVersion}  glue ${glue}`);
for (const line of report) console.log("  " + line);
