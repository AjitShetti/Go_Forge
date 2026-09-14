// Minimal static server for public/ (P0 proof page, before Next.js exists).
// gzip-compresses once per file and caches in memory; hashed engine files are
// served immutable so the browser HTTP cache makes repeat visits instant.
//   node scripts/serve-static.mjs [port]
import { readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..", "public");
const port = Number(process.argv[2] ?? 4173);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".wasm": "application/wasm", ".pack": "application/octet-stream", ".css": "text/css" };
const gzCache = new Map();

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(root, path));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  let st;
  try {
    st = statSync(file);
  } catch {
    return res.writeHead(404).end("not found");
  }
  if (st.isDirectory()) return res.writeHead(302, { Location: path + "/" }).end();
  const hashed = /\.[0-9a-f]{10}\.(wasm|pack)$/.test(file);
  const headers = {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
    "Cache-Control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
  };
  if (/\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
    const key = `${file}:${st.mtimeMs}`;
    if (!gzCache.has(key)) gzCache.set(key, gzipSync(readFileSync(file), { level: 6 }));
    const body = gzCache.get(key);
    res.writeHead(200, { ...headers, "Content-Encoding": "gzip", "Content-Length": body.length });
    return res.end(body);
  }
  const body = readFileSync(file);
  res.writeHead(200, { ...headers, "Content-Length": body.length });
  res.end(body);
}).listen(port, () => console.log(`serving ${root} at http://localhost:${port}/`));
