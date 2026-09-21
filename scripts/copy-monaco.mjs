// Copies Monaco's prebuilt AMD build into public/monaco/vs so the editor loads
// from this origin (the @monaco-editor/react default is a CDN). Runs before dev/build.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "node_modules", "monaco-editor", "package.json"), "utf8"));
const src = join(root, "node_modules", "monaco-editor", "min", "vs");
// The version is in the URL so the 24 MB of editor chunks can be cached immutably:
// an upgrade changes every path, so a stale file can never be served. The loader
// path in src/components/code-editor.tsx is built from the same package version.
const dest = join(root, "public", "monaco", pkg.version, "vs");
const stamp = join(root, "public", "monaco", "VERSION");

// The app builds the loader URL from MONACO_VERSION; if an upgrade moves the files
// without moving that constant, the editor 404s at runtime. Fail here instead.
const declared = readFileSync(join(root, "src", "lib", "monaco.ts"), "utf8").match(/MONACO_VERSION\s*=\s*"([^"]+)"/)?.[1];
if (declared !== pkg.version) {
  throw new Error(`monaco-editor is ${pkg.version} but src/lib/monaco.ts declares ${declared}. Update MONACO_VERSION to "${pkg.version}".`);
}

// `dest` is checked too, not just the stamp: the stamp alone would call a tree
// left at an older layout (pre-versioned paths) up to date and skip the copy.
if (existsSync(dest) && existsSync(stamp) && readFileSync(stamp, "utf8").trim() === pkg.version) {
  console.log(`monaco ${pkg.version} already in public/monaco`);
} else {
  rmSync(join(root, "public", "monaco"), { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  writeFileSync(stamp, pkg.version + "\n");
  console.log(`copied monaco ${pkg.version} to public/monaco/${pkg.version}/vs`);
}
