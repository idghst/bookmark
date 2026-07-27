import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { metadata } from "@/app/layout";

describe("PWA manifest", () => {
  it("설치에 필요한 앱 정보와 아이콘을 제공한다", () => {
    expect(manifest()).toMatchObject({
      start_url: "/",
      display: "standalone",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192" },
        { src: "/icons/icon-512.png", sizes: "512x512" }
      ]
    });
  });

  it("uses Bookmark branding across metadata and static PWA fallbacks", () => {
    expect(metadata.icons).toMatchObject({
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }]
    });
    expect(readFileSync("public/favicon.svg", "utf8")).toContain('aria-label="Bookmark"');
    expect(readFileSync("public/offline.html", "utf8")).toContain("<title>오프라인 | Bookmark</title>");
    expect(readFileSync("public/sw.js", "utf8")).toContain('const CACHE_NAME = "bookmark-pwa-v1"');
  });
});
