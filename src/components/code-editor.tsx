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
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "00add8", fontStyle: "bold" },
      { token: "type", foreground: "4fcbeb" },
      { token: "string", foreground: "a8d890" },
      { token: "number", foreground: "e6b450" },
      { token: "comment", foreground: "7d7a6f", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#121310",
      "editorLineNumber.foreground": "#4a4c44",
      "editorLineNumber.activeForeground": "#00add8",
      "editor.lineHighlightBackground": "#1a1b17",
      "editorCursor.foreground": "#00add8",
      "editor.selectionBackground": "#0b3a45",
      "editorGutter.background": "#121310",
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
    <div className="border border-line" data-testid={`editor-${id}`}>
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
