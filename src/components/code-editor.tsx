"use client";

import Editor, { loader, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

// Monaco is served from this origin (scripts/copy-monaco.mjs), not a CDN.
loader.config({ paths: { vs: "/monaco/vs" } });

type MonacoEditor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];

declare global {
  interface Window {
    /** Test hook: lets browser tests set editor contents without simulating typing. */
    __goforgeEditors?: Record<string, MonacoEditor>;
  }
}

let themeDefined = false;
function defineTheme(monaco: Monaco) {
  if (themeDefined) return;
  themeDefined = true;
  monaco.editor.defineTheme("goforge", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "3d4df0", fontStyle: "bold" },
      { token: "type", foreground: "3d4df0" },
      { token: "string", foreground: "177a3b" },
      { token: "number", foreground: "9a6700" },
      { token: "comment", foreground: "8a877f", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#fdfcf8",
      "editorLineNumber.foreground": "#b3b0a6",
      "editorLineNumber.activeForeground": "#3d4df0",
      "editor.lineHighlightBackground": "#f1efe7",
      "editorCursor.foreground": "#3d4df0",
    },
  });
}

export function CodeEditor({
  id,
  value,
  onChange,
  lockedLines = [],
  height = 320,
  readOnly = false,
}: {
  id: string;
  value: string;
  onChange?: (v: string) => void;
  lockedLines?: number[];
  height?: number;
  readOnly?: boolean;
}) {
  const editorRef = useRef<MonacoEditor | null>(null);
  const decorations = useRef<{ clear(): void } | null>(null);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !decorations.current) return;
    decorations.current.clear();
    decorations.current = ed.createDecorationsCollection(lockedLines.map((n) => lockDecoration(n)));
  }, [lockedLines]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    decorations.current = editor.createDecorationsCollection(lockedLines.map((n) => lockDecoration(n)));
    window.__goforgeEditors = { ...(window.__goforgeEditors ?? {}), [id]: editor };
  };

  return (
    <div className="border border-ink" data-testid={`editor-${id}`}>
      <Editor
        height={height}
        language="go"
        theme="goforge"
        value={value}
        beforeMount={defineTheme}
        onMount={onMount}
        onChange={(v) => onChange?.(v ?? "")}
        loading={<div className="p-4 font-mono text-sm text-ink-3">Loading editor…</div>}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "JetBrains Mono, ui-monospace, Consolas, monospace",
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          renderLineHighlight: "line",
          tabSize: 4,
          insertSpaces: false,
          glyphMargin: lockedLines.length > 0,
          automaticLayout: true,
          padding: { top: 10, bottom: 10 },
        }}
      />
    </div>
  );
}

function lockDecoration(line: number) {
  return {
    range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
    options: { isWholeLine: true, className: "gf-locked-line", glyphMarginClassName: "gf-locked-glyph", glyphMarginHoverMessage: { value: "Locked: must stay unchanged" } },
  };
}
