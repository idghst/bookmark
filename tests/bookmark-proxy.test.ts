import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("bookmark proxy access boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("lets unauthenticated navigation reach the app when access is configured", async () => {
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const { proxy } = await import("@/proxy");

    const response = proxy(new NextRequest("https://bookmark.example.com/"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("fails closed when the server access key is absent", async () => {
    vi.stubEnv("BOOKMARK_API_KEY", "");
    const { proxy } = await import("@/proxy");

    const response = proxy(new NextRequest("https://bookmark.example.com/"));

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
