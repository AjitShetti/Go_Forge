import type { ReactNode } from "react";
import { parseFenceInfo } from "@/lib/content/lesson";
import { Diagram } from "./diagrams";

// Minimal Markdown renderer for trusted lesson content. Supported subset:
// paragraphs, **bold**, *italic*, `code`, [links](url), - / 1. lists,
// > blockquotes, ### headings, fenced code, and ```diagram name=<id>``` fences.
// Renders React elements only (no raw HTML).

export type VerifiedOutput = { stdout: string; stderr: string; exitCode: number };
export type MarkdownProps = {
  source: string;
  /** Verified outputs for ```go verified id=…``` fences, from expected.json. */
  verified?: Record<string, VerifiedOutput>;
  goVersion?: string;
};

type Block =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "fence"; info: string; code: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const info = line.slice(3);
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push({ kind: "fence", info, code: code.join("\n") });
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4) });
      i++;
      continue;
    }
    const listKind = /^\s*[-*] /.test(line) ? "ul" : /^\s*\d+\. /.test(line) ? "ol" : null;
    if (listKind) {
      const items: string[] = [];
      while (i < lines.length && (listKind === "ul" ? /^\s*[-*] /.test(lines[i]) : /^\s*\d+\. /.test(lines[i]))) {
        items.push(lines[i].replace(/^\s*(?:[-*]|\d+\.) /, ""));
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) items[items.length - 1] += " " + lines[i++].trim();
      }
      blocks.push({ kind: listKind, items });
      continue;
    }
    if (line.startsWith(">")) {
      const text: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) text.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push({ kind: "quote", text: text.join(" ") });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(```|### |>|\s*[-*] |\s*\d+\. )/.test(lines[i])) para.push(lines[i++]);
    blocks.push({ kind: "p", text: para.join(" ") });
  }
  return blocks;
}

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (m[1]) out.push(<code key={key++}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key++}>{renderInline(tok.slice(2, -2))}</strong>);
    else if (m[3]) out.push(<em key={key++}>{renderInline(tok.slice(1, -1))}</em>);
    else {
      const [, label, href] = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      const external = /^https?:/.test(href);
      out.push(
        <a key={key++} href={href} className="text-blue underline underline-offset-2" {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
          {renderInline(label)}
        </a>,
      );
    }
    last = m.index! + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, verified = {}, goVersion }: MarkdownProps) {
  return (
    <div className="prose-serif grid gap-4">
      {parseBlocks(source).map((b, i) => {
        switch (b.kind) {
          case "p":
            return <p key={i}>{renderInline(b.text)}</p>;
          case "h3":
            return (
              <h3 key={i} className="label mt-2">
                {b.text}
              </h3>
            );
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-blue pl-4 text-ink-2">
                {renderInline(b.text)}
              </blockquote>
            );
          case "ul":
          case "ol": {
            const Tag = b.kind;
            return (
              <Tag key={i} className={`grid gap-1.5 pl-6 ${b.kind === "ul" ? "list-disc" : "list-decimal"}`}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </Tag>
            );
          }
          case "fence": {
            const { lang, meta } = parseFenceInfo(b.info);
            if (lang === "diagram" && typeof meta.name === "string") return <Diagram key={i} name={meta.name} />;
            const id = typeof meta.id === "string" ? meta.id : null;
            const out = id ? verified[id] : undefined;
            return (
              <figure key={i} className="panel not-prose font-mono">
                <div className="panel-head">
                  <span className="label">{lang || "text"}</span>
                  {meta.verified && <span className="label text-ok">verified{goVersion ? ` · ${goVersion}` : ""}</span>}
                </div>
                <pre className="code-block overflow-x-auto p-4">{b.code}</pre>
                {out && (
                  <div className="border-t border-rule bg-paper-2 px-4 py-3">
                    <p className="label mb-1">Output</p>
                    <pre className="code-block">
                      {out.stdout}
                      {out.stderr && <span className="text-bad">{out.stderr}</span>}
                    </pre>
                  </div>
                )}
                {meta.verified && !out && <p className="px-4 py-2 font-mono text-xs text-bad">UNVERIFIED BLOCK: no recorded output for id {String(id)}</p>}
              </figure>
            );
          }
        }
      })}
    </div>
  );
}
