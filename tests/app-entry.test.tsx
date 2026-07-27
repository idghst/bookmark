import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app entry", () => {
  it("serves bookmarks directly from the root route", () => {
    const source = readFileSync("app/(dashboard)/page.tsx", "utf8");
    expect(source).toContain("export default function BookmarksPage");
    expect(source).not.toContain("redirect(");
  });
});
