// Runs Go source with the local toolchain (`go run` / `go build`) in a temp module.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function goVersion() {
  return spawnSync("go", ["env", "GOVERSION"], { encoding: "utf8" }).stdout.trim();
}

/**
 * @param {string} source
 * @param {{lang?: string, gcflags?: string[], buildOnly?: boolean, timeoutMs?: number}} opts
 *   lang like "go1.21" becomes the go.mod `go` directive, which is what decides
 *   language semantics such as per-iteration loop variables.
 */
export function runRealGo(source, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), "goforge-"));
  try {
    const directive = (opts.lang ?? goVersion().split(".").slice(0, 2).join(".")).replace(/^go/, "");
    writeFileSync(join(dir, "go.mod"), `module prog\n\ngo ${directive}\n`);
    writeFileSync(join(dir, "main.go"), source);
    const args = opts.buildOnly ? ["build", "-o", join(dir, "prog.exe")] : ["run"];
    if (opts.gcflags) args.push(`-gcflags=${opts.gcflags.join(" ")}`);
    args.push(".");
    const res = spawnSync("go", args, {
      cwd: dir,
      encoding: "utf8",
      timeout: opts.timeoutMs ?? 60000,
      killSignal: "SIGKILL",
      env: { ...process.env, GOFLAGS: "-mod=mod", GOTOOLCHAIN: "local" },
    });
    // `go run` exits 1 whenever the program fails and appends "exit status N"
    // with the program's real code; report the program's code.
    let stderr = res.stderr ?? "";
    let exitCode = res.status ?? -1;
    const m = stderr.match(/exit status (\d+)\r?\n$/);
    if (m) {
      exitCode = Number(m[1]);
      stderr = stderr.slice(0, m.index);
    }
    return { stdout: res.stdout ?? "", stderr, exitCode, timedOut: res.error?.code === "ETIMEDOUT" };
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

/**
 * `go test -v -count=1` over the given files (package main) in a temp module.
 * @param {{name: string, content: string}[]} files
 */
export function runRealGoTest(files, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), "goforge-"));
  try {
    const directive = (opts.lang ?? goVersion().split(".").slice(0, 2).join(".")).replace(/^go/, "");
    writeFileSync(join(dir, "go.mod"), `module prog\n\ngo ${directive}\n`);
    for (const f of files) writeFileSync(join(dir, f.name), f.content);
    const res = spawnSync("go", ["test", "-v", "-count=1", "."], {
      cwd: dir,
      encoding: "utf8",
      timeout: opts.timeoutMs ?? 120000,
      env: { ...process.env, GOFLAGS: "-mod=mod", GOTOOLCHAIN: "local" },
    });
    return { stdout: res.stdout ?? "", stderr: res.stderr ?? "", exitCode: res.status ?? -1 };
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

/**
 * Normalizes output so real-Go and engine results can be compared without
 * hiding real differences. Only things that legitimately differ by platform or
 * build location are rewritten:
 *  - source paths (temp dir, GOROOT) -> bare relative paths
 *  - PC offsets (+0x4a) and pointer/argument hex values in stack frames
 *  - goroutine ids, native-only "[signal ...]" lines, "# prog" build header
 */
export function normalizeOutput(s) {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/^# prog\n/m, "")
    .replace(/\.\\main\.go/g, "./main.go")
    .replace(/[A-Za-z]:[\\/][^\s:]*?[\\/]goforge-[^\\/]+[\\/]main\.go/g, "main.go")
    .replace(/[A-Za-z]:\/[^\n:]*?\/Go\/src\//g, "")
    .replace(/ \+0x[0-9a-f]+/g, "")
    .replace(/\((0x[0-9a-f]+(, )?|\.\.\.(, )?)+\)/g, "(...)")
    .replace(/goroutine \d+/g, "goroutine N")
    .replace(/^\[signal .*\]\n/gm, "");
}
