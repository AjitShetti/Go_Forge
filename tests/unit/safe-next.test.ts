import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/safe-next";

describe("safeNext", () => {
  it("keeps same-origin paths with query and hash", () => {
    expect(safeNext("/review/nil-map")).toBe("/review/nil-map");
    expect(safeNext("/track?x=1#provoke")).toBe("/track?x=1#provoke");
  });

  it("falls back when missing or relative", () => {
    expect(safeNext(null)).toBe("/track");
    expect(safeNext("")).toBe("/track");
    expect(safeNext("review")).toBe("/track");
  });

  it("rejects paths that resolve to another host", () => {
    for (const evil of ["//evil.com", "//evil.com/track", "/\\evil.com", "https://evil.com", "/\\/evil.com", "javascript:alert(1)"]) {
      expect(safeNext(evil), evil).toBe("/track");
    }
  });
});
