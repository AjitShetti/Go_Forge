// Browser Web Worker entry point for the Go engine.
// Loaded as a classic worker: new Worker("/engine/worker.js").
/* global importScripts, GoForgeMemFS, GoForgeSession */

const params = new URL(self.location.href).searchParams;
const base = new URL("./", self.location.href);
const gen = new URL("gen/", base);

importScripts(new URL("memfs.js", base).href);
// wasm_exec.js only installs its console-backed fs stub if globalThis.fs is
// missing; install a real one first.
GoForgeMemFS.installFS(GoForgeMemFS.createMemFS());
importScripts(new URL("wasm_exec.js", gen).href, new URL("toolchain.js", base).href, new URL("session.js", base).href);

const onMessage = GoForgeSession.createSession({
  post: (m) => self.postMessage(m),
  // Hashed filenames make these immutable, so the HTTP cache serves repeat visits.
  fetchFile: async (file) => {
    const res = await fetch(new URL(file, gen));
    if (!res.ok) throw new Error(`engine: fetching ${file}: HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    // Files are stored gzipped. A host that serves them with Content-Encoding
    // has already inflated them, so check the gzip magic instead of trusting the name.
    const b = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
    if (!file.endsWith(".gz") || b[0] !== 0x1f || b[1] !== 0x8b) return buf;
    return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  },
  loadManifest: async () => {
    const res = await fetch(new URL("manifest.json", gen), { cache: params.get("nocache") ? "reload" : "no-cache" });
    if (!res.ok) throw new Error(`engine: manifest: HTTP ${res.status} (run npm run engine:build)`);
    return res.json();
  },
});

self.onmessage = (e) => onMessage(e.data);
