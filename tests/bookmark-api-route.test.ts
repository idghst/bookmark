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
    vi.stubEnv("BOOKMARK_USER_ID", "user-1");
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", "sb_secret_test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ position: 0 }]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "bookmark-1",
              user_id: "user-1",
              title: "Example",
              url: "https://example.com/",
              description: null,
              is_favorite: false,
              created_at: "2026-07-27T00:00:00.000Z",
              updated_at: null,
              folder_id: null,
              section_id: null,
              position: 1
            }
          ]),
          { status: 201 }
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
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({
      url: "https://example.com/"
    });
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
