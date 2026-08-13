import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

function clientAuthorization(password = "bookmark-api-secret") {
  return `Basic ${Buffer.from(`bookmark:${password}`).toString("base64")}`;
}

describe("bookmark proxy access boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("challenges unauthenticated navigation before bookmark data can load", async () => {
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const { proxy } = await import("@/proxy");

    const response = proxy(new NextRequest("https://bookmark.example.com/"));

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("lets a browser with the configured credentials reach the app", async () => {
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const { proxy } = await import("@/proxy");

    const response = proxy(
      new NextRequest("https://bookmark.example.com/api/bookmarks", {
        headers: { Authorization: clientAuthorization() }
      })
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("accepts a case-insensitive Basic authentication scheme", async () => {
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const { proxy } = await import("@/proxy");

    const response = proxy(
      new NextRequest("https://bookmark.example.com/", {
        headers: { Authorization: clientAuthorization().replace("Basic", "basic") }
      })
    );

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
