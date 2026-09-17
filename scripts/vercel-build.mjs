// Vercel's build command (vercel.json). The Go engine in public/engine/gen is
// not in git, so a deploy builds it here:
//   1. install the Go release every lesson's expected output was recorded with
//      (checksum verified against go.dev),
//   2. build the engine, or restore it from Vercel's build cache when neither
//      the Go version nor scripts/build-engine.mjs changed,
//   3. run the normal `npm run build`.
// Locally, `npm run engine:build && npm run build` does the same with your Go.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const GO_VERSION = "go1.27.1";
const root = resolve(import.meta.dirname, "..");
const gen = join(root, "public", "engine", "gen");
const run = (cmd, args, env = process.env) => execFileSync(cmd, args, { cwd: root, env, stdio: "inherit" });

// Every recorded lesson output names the Go version it came from; refuse to build a different engine.
const recorded = new Set(
  readdirSync(join(root, "content"), { recursive: true })
    .filter((p) => String(p).endsWith("expected.json"))
    .map((p) => JSON.parse(readFileSync(join(root, "content", String(p)), "utf8")).goVersion),
);
if (recorded.size !== 1 || !recorded.has(GO_VERSION)) throw new Error(`lessons were recorded with ${[...recorded]}, but this build pins ${GO_VERSION}`);

const key = createHash("sha256").update(GO_VERSION).update(readFileSync(join(root, "scripts/build-engine.mjs"))).digest("hex").slice(0, 16);
const cached = join(root, ".next", "cache", "go-forge-engine", key);

if (existsSync(join(cached, "manifest.json"))) {
  console.log(`engine: restored from build cache (${key})`);
  rmSync(gen, { recursive: true, force: true });
  cpSync(cached, gen, { recursive: true });
} else {
  const goRoot = await installGo();
  const env = { ...process.env, PATH: `${join(goRoot, "bin")}:${process.env.PATH}`, GOROOT: goRoot, GOTOOLCHAIN: "local", GOCACHE: "/tmp/go-build-cache", GOPATH: "/tmp/gopath" };
  run("node", ["scripts/build-engine.mjs"], env);
  rmSync(join(root, ".next", "cache", "go-forge-engine"), { recursive: true, force: true });
  mkdirSync(cached, { recursive: true });
  cpSync(gen, cached, { recursive: true });
}

run("npm", ["run", "build"]);

async function installGo() {
  const dir = `/tmp/${GO_VERSION}`;
  if (existsSync(join(dir, "go", "bin", "go"))) return join(dir, "go");
  const name = `${GO_VERSION}.linux-amd64.tar.gz`;
  const releases = await (await fetch("https://go.dev/dl/?mode=json&include=all")).json();
  const want = releases.flatMap((r) => r.files).find((f) => f.filename === name)?.sha256;
  if (!want) throw new Error(`go.dev lists no ${name}`);
  console.log(`engine: downloading ${name}`);
  const res = await fetch(`https://go.dev/dl/${name}`);
  if (!res.ok) throw new Error(`downloading ${name}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const got = createHash("sha256").update(bytes).digest("hex");
  if (got !== want) throw new Error(`${name}: sha256 ${got}, expected ${want}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), bytes);
  run("tar", ["-xzf", join(dir, name), "-C", dir]);
  return join(dir, "go");
}
