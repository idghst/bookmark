import { describe, expect, it } from "vitest";
import { bookmarkHost, normalizeUrl, safeUrl } from "@/app/lib/bookmarks/url";

describe("bookmark urls", () => {
  it("adds https when the scheme is missing", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(safeUrl("example.com")).toBe("https://example.com/");
  });

  it("rejects non-http schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
  });

  it("strips www from the displayed host", () => {
    expect(bookmarkHost("https://www.example.com/path")).toBe("example.com");
  });
});
