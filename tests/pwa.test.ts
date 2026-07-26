import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

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
});
