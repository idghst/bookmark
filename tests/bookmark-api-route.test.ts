import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

function context(resource: string, path?: string[]) {
  return { params: Promise.resolve({ resource, path }) };
}

function request(path: string, method: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("bookmark API write boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it.each([
    [{ title: "Bad", url: "javascript:alert(1)", isFavorite: false, folderId: null, sectionId: null }],
    [{ title: 42, url: "https://example.com", isFavorite: false, folderId: null, sectionId: null }],
    [{ title: "Missing fields", url: "https://example.com" }]
  ])("rejects malformed bookmark POST bodies", async (body) => {
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("@/app/api/[resource]/[[...path]]/route");

    const response = await POST(
      request("/api/bookmarks", "POST", body),
      context("bookmarks")
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("normalizes an omitted bookmark URL scheme before writing", async () => {
    vi.stubEnv(
      "BOOKMARK_GRAPHQL_URL",
      "https://graphql.example.com/api/graphql"
    );
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            createBookmark: {
              id: "bookmark-1",
              title: "Example",
              url: "https://example.com/",
              description: null,
              isFavorite: false,
              folderId: null,
              sectionId: null,
              position: 1
            }
          }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/[resource]/[[...path]]/route");

    const response = await POST(
      request("/api/bookmarks", "POST", {
        title: "Example",
        url: "example.com",
        description: null,
        isFavorite: false,
        folderId: null,
        sectionId: null
      }),
      context("bookmarks")
    );

    expect(response.status).toBe(201);
    expect(
      JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body)).variables
    ).toMatchObject({ input: { url: "https://example.com/" } });
  });

  it.each([
    ["bookmarks", [{ id: "bookmark-1", position: -1 }]],
    ["folders", [{ id: "", position: 0 }]],
    ["sections", [{ id: "section-1", position: 1.5 }]],
    ["bookmarks", { id: "bookmark-1", position: 0 }]
  ])("rejects malformed %s reorder bodies", async (resource, body) => {
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("@/app/api/[resource]/[[...path]]/route");

    const response = await POST(
      request(`/api/${resource}/reorder`, "POST", body),
      context(resource, ["reorder"])
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 404 for reorder paths with extra segments", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("@/app/api/[resource]/[[...path]]/route");

    const response = await POST(
      request("/api/bookmarks/reorder/extra", "POST", []),
      context("bookmarks", ["reorder", "extra"])
    );

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed PATCH bodies", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { PATCH } = await import("@/app/api/[resource]/[[...path]]/route");

    const response = await PATCH(
      request("/api/bookmarks/bookmark-1", "PATCH", { isFavorite: "yes" }),
      context("bookmarks", ["bookmark-1"])
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
