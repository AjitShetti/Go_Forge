// Search-facing text and structured data. The descriptions here are derived from
// the lesson prose itself rather than hand-written, so every one of the 43 lesson
// pages carries a unique, accurate summary instead of the site-wide default.
import { SITE_URL } from "@/lib/site";

export const SITE_NAME = "Go Forge";

/** Absolute URL for a site-relative path, for canonicals and JSON-LD `@id`. */
export const abs = (path: string) => new URL(path, SITE_URL).toString();

/**
 * Markdown → one line of plain prose, cut at a sentence boundary when one falls
 * near the limit. Drops fenced code, headings, list markers and inline markup,
 * because a meta description made of backticks and pipes reads as noise in a
 * result snippet.
 */
export function summarize(markdown: string | undefined, max = 155): string {
  if (!markdown) return "";
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, " ") // headings
    .replace(/^\s{0,3}[-*+]\s+/gm, " ") // list bullets
    .replace(/^\s{0,3}>\s?/gm, " ") // block quotes
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const window = text.slice(0, max + 40);
  const stop = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
  if (stop > max * 0.55) return window.slice(0, stop + 1);
  const space = text.lastIndexOf(" ", max);
  return `${text.slice(0, space > 0 ? space : max).trimEnd()}…`;
}

/**
 * What this lesson teaches, in one line: the Decode prose if there is any, else
 * the question the learner is asked. Both are unique per lesson.
 */
export function lessonDescription(decode: string | undefined, trapQuestion: string, title: string): string {
  const TAIL = "Predict it, run real Go in your browser, then find out why.";
  const body = summarize(decode, 95) || summarize(`${title}. ${trapQuestion}`, 95);
  // Clipped on a word, not a sentence: the tail is the part that has to survive.
  return clip(`${body} ${TAIL}`, 160);
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const space = text.lastIndexOf(" ", max);
  return `${text.slice(0, space > 0 ? space : max).trimEnd()}…`;
}

/**
 * JSON-LD as the docs prescribe: stringified with `<` escaped, so a stray angle
 * bracket in lesson prose can never close the script tag.
 * See node_modules/next/dist/docs/01-app/02-guides/json-ld.md.
 */
export function jsonLdScript(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

/**
 * BreadcrumbList; Google renders these as the path shown under a result title.
 * No `@context` of its own — every caller nests this inside a graph that has one.
 */
export function breadcrumbs(trail: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: abs(t.path),
    })),
  };
}

export const ORGANIZATION = {
  "@type": "Organization",
  "@id": abs("/#organization"),
  name: SITE_NAME,
  url: SITE_URL,
};
