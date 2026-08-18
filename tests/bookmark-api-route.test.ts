import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function context(resource: string, path?: string[]) {
  return { params: Promise.resolve({ resource, path }) };
}

function clientAuthorization(password = "bookmark-api-secret") {
  return `Basic ${Buffer.from(`bookmark:${password}`).toString("base64")}`;
}

function request(
  path: string,
  method: string,
  body: unknown,
  authorization = clientAuthorization()
) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify(body)
  });
}

describe("bookmark API write boundary", () => {
  beforeEach(() => {
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("allows unauthenticated browser requests when access is configured", async () => {
    vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/[resource]/[[...path]]/route");

    const response = await GET(
      new NextRequest("http://localhost/api/bookmarks"),
      context("bookmarks")
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
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
    vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com");
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "bookmark-1",
          title: "Example",
          url: "https://example.com/",
          description: null,
          isFavorite: false,
          folderId: null,
          sectionId: null,
          position: 1
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

  it("forwards section PATCH color and folder move requests to REST", async () => {
    vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com");
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "section-1",
          name: "수정된 섹션",
          color: "#16a34a",
          folderId: "folder-2",
          position: 0
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { PATCH } = await import("@/app/api/[resource]/[[...path]]/route");

    const response = await PATCH(
      request("/api/sections/section-1", "PATCH", {
        name: "수정된 섹션",
        color: "#16a34a",
        folderId: "folder-2"
      }),
      context("sections", ["section-1"])
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "수정된 섹션",
      color: "#16a34a",
      folderId: "folder-2"
    });
  });

  it("forwards a section color on creation", async () => {
    vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com");
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "section-1",
            name: "새 섹션",
            color: "#db2777",
            folderId: "folder-1",
            position: 0
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/[resource]/[[...path]]/route");

    const response = await POST(
      request("/api/sections", "POST", {
        folderId: "folder-1",
        name: "새 섹션",
        color: "#db2777"
      }),
      context("sections")
    );

    expect(response.status).toBe(201);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      folderId: "folder-1",
      name: "새 섹션",
      color: "#db2777"
    });
  });

  it("forwards folder parentId and destination_folder_id to REST", async () => {
    vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com");
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "child-folder",
            name: "하위 폴더",
            color: "#4f46e5",
            parentId: "root-folder",
            position: 0
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(null, { status: 204 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const { DELETE, PATCH } = await import("@/app/api/[resource]/[[...path]]/route");

    const patchResponse = await PATCH(
      request("/api/folders/child-folder", "PATCH", {
        name: "하위 폴더",
        parentId: "root-folder"
      }),
      context("folders", ["child-folder"])
    );
    const deleteResponse = await DELETE(
      new NextRequest(
        "http://localhost/api/folders/child-folder?destination_folder_id=fallback-folder",
        { method: "DELETE", headers: { Authorization: clientAuthorization() } }
      ),
      context("folders", ["child-folder"])
    );

    expect(patchResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(204);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "하위 폴더",
      parentId: "root-folder"
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://api.example.com/api/folders/child-folder?destination_folder_id=fallback-folder"
    );
  });
});
