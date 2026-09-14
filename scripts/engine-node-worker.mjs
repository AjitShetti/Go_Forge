// worker_threads entry: loads the browser engine scripts unchanged and speaks
// the same protocol as public/engine/worker.js.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import vm from "node:vm";
import { parentPort } from "node:worker_threads";

const engineDir = resolve(import.meta.dirname, "..", "public", "engine");
const gen = join(engineDir, "gen");
const load = (file) => vm.runInThisContext(readFileSync(file, "utf8"), { filename: file });

load(join(engineDir, "memfs.js"));
globalThis.GoForgeMemFS.installFS(globalThis.GoForgeMemFS.createMemFS());
load(join(gen, "wasm_exec.js"));
load(join(engineDir, "toolchain.js"));
load(join(engineDir, "session.js"));

const onMessage = globalThis.GoForgeSession.createSession({
  post: (m) => parentPort.postMessage(m),
  fetchFile: async (file) => {
    const b = readFileSync(join(gen, file));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  },
  loadManifest: async () => JSON.parse(readFileSync(join(gen, "manifest.json"), "utf8")),
});
parentPort.on("message", onMessage);
