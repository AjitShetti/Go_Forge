"use client";

import { useEffect, useRef, useState } from "react";
import { getExecutor } from "@/lib/engine/wasm-executor";
import type { EngineCapabilities, ExecResult } from "@/lib/engine/types";

const EXAMPLES: Record<string, string> = {
  "goroutines + WaitGroup + channel": `package main

import (
	"fmt"
	"sync"
)

func main() {
	results := make(chan int)
	var wg sync.WaitGroup
	for i := 1; i <= 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results <- i * i
		}()
	}
	go func() {
		wg.Wait()
		close(results)
	}()
	sum := 0
	for r := range results {
		sum += r
	}
	fmt.Println("sum of squares:", sum)
}
`,
  "panic: index out of range": `package main

import "fmt"

func main() {
	xs := []int{1, 2, 3}
	i := 5
	fmt.Println("before")
	fmt.Println(xs[i])
}
`,
  "panic: nil map write": `package main

func main() {
	var m map[string]int
	m["boom"] = 1
}
`,
  deadlock: `package main

import "fmt"

func main() {
	ch := make(chan int)
	fmt.Println("sending")
	ch <- 1
}
`,
  "loop variable capture (try go1.21)": `package main

import "fmt"

func main() {
	var fns []func()
	for i := 0; i < 3; i++ {
		fns = append(fns, func() { fmt.Print(i, " ") })
	}
	for _, f := range fns {
		f()
	}
	fmt.Println()
}
`,
  "infinite loop (timeout)": `package main

func main() {
	for {
	}
}
`,
  "compile error": `package main

import "fmt"

func main() {
	x := 1
	fmt.Println("hi")
}
`,
};

declare global {
  interface Window {
    __coldStartMs?: number;
    __lastResult?: ExecResult;
  }
}

export function EngineLab() {
  const [example, setExample] = useState(Object.keys(EXAMPLES)[0]);
  const [code, setCode] = useState(EXAMPLES[example]);
  const [lang, setLang] = useState("");
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [status, setStatus] = useState("Loading engine…");
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [result, setResult] = useState<ExecResult | null>(null);
  const [caps, setCaps] = useState<EngineCapabilities | null>(null);
  const started = useRef(performance.now());

  useEffect(() => {
    const ex = getExecutor();
    ex.ready().then(
      (info) => {
        const ms = Math.round(performance.now() - started.current);
        window.__coldStartMs = ms;
        setStatus(`engine ready in ${ms} ms (${info.goVersion})`);
        setCaps(ex.capabilities());
        setReady(true);
      },
      (err: Error) => setStatus(`ENGINE FAILED: ${err.message}`),
    );
  }, []);

  async function run() {
    setRunning(true);
    setStdout("");
    setStderr("");
    setResult(null);
    setStatus("compiling…");
    window.__lastResult = undefined;
    const r = await getExecutor().run([{ name: "main.go", content: code }], {
      timeoutMs,
      lang: lang || undefined,
      onStdout: (s) => setStdout((o) => o + s),
      onStderr: (s) => setStderr((o) => o + s),
    });
    setStdout(r.stdout);
    setStderr(r.stderr);
    setResult(r);
    setStatus(`done: ${r.status}`);
    setRunning(false);
    window.__lastResult = r;
  }

  return (
    <div className="mt-8 grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          id="example"
          className="field w-auto"
          value={example}
          onChange={(e) => {
            setExample(e.target.value);
            setCode(EXAMPLES[e.target.value]);
          }}
        >
          {Object.keys(EXAMPLES).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          <span className="label">go directive</span>
          <select id="lang" className="field w-auto" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">default</option>
            <option>go1.21</option>
            <option>go1.22</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="label">timeout ms</span>
          <input id="timeout" className="field w-28" type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value))} />
        </label>
        <button id="run" className="btn btn-solid" disabled={!ready || running} onClick={run}>
          Run
        </button>
        <span id="status" data-testid="status" className="font-mono text-sm text-ink-2">
          {status}
        </span>
      </div>

      <textarea id="code" spellCheck={false} className="field code-block h-80 resize-y" value={code} onChange={(e) => setCode(e.target.value)} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel">
          <div className="panel-head">
            <span className="label">stdout</span>
          </div>
          <pre data-testid="stdout" className="code-block min-h-16 p-4">
            {stdout}
          </pre>
        </div>
        <div className="panel">
          <div className="panel-head">
            <span className="label">stderr</span>
          </div>
          <pre data-testid="stderr" className="code-block min-h-16 p-4 text-bad">
            {stderr}
          </pre>
        </div>
      </div>

      {result && (
        <pre data-testid="result" className="panel code-block p-4">
          {JSON.stringify({ status: result.status, exitCode: result.exitCode, compileMs: result.compileMs, linkMs: result.linkMs, runMs: result.runMs, totalMs: result.totalMs, engineError: result.engineError }, null, 2)}
        </pre>
      )}

      {caps && (
        <details className="panel">
          <summary className="panel-head cursor-pointer">
            <span className="label">capabilities()</span>
          </summary>
          <pre className="code-block p-4">{JSON.stringify({ ...caps, stdlib: `${caps.stdlib.length} packages` }, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
