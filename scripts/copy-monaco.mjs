// Copies Monaco's prebuilt AMD build into public/monaco/vs so the editor loads
// from this origin (the @monaco-editor/react default is a CDN). Runs before dev/build.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "node_modules", "monaco-editor", "package.json"), "utf8"));
const src = join(root, "node_modules", "monaco-editor", "min", "vs");
const dest = join(root, "public", "monaco", "vs");
const stamp = join(root, "public", "monaco", "VERSION");

if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === pkg.version) {
  console.log(`monaco ${pkg.version} already in public/monaco`);
} else {
  rmSync(join(root, "public", "monaco"), { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  writeFileSync(stamp, pkg.version + "\n");
  console.log(`copied monaco ${pkg.version} to public/monaco/vs`);
}
