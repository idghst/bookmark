import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const context = (resource: string, path?: string[]) => ({ params: Promise.resolve({ resource, path }) });
const request = (path: string, method: string, body: unknown) =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

describe("bookmark API write boundary", () => {
  beforeEach(() => {
    vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com");
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("allows unauthenticated browser requests when access is configured", async () => {
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

  it("forwards bookmark POST without sectionId", async () => {
    const created = {
      id: "bookmark-1",
      title: "Example",
      url: "https://example.com/",
      description: null,
      isFavorite: false,
      folderId: "folder-1",
      position: 0
    };
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify(created), { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/[resource]/[[...path]]/route");
    const response = await POST(request("/api/bookmarks", "POST", {
      title: "Example",
      url: "example.com",
      description: null,
      isFavorite: false,
      folderId: "folder-1"
    }), context("bookmarks"));
    expect(response.status).toBe(201);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty("sectionId");
  });

  it("normalizes an omitted bookmark URL scheme before writing", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(
        JSON.stringify({
          id: "bookmark-1",
          title: "Example",
          url: "https://example.com/",
          description: null,
          isFavorite: false,
          folderId: "folder-1",
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
        folderId: "folder-1"
      }),
      context("bookmarks")
    );

    expect(response.status).toBe(201);
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({
      url: "https://example.com/"
    });
  });

  it("forwards folder-section CRUD without sidebar section fields", async () => {
    const created = {
      id: "folder-section-1",
      name: "읽을 글",
      folderId: "folder-1",
      position: 0
    };
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify(created), { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/[resource]/[[...path]]/route");
    const response = await POST(request("/api/folder-sections", "POST", {
      name: "읽을 글",
      folderId: "folder-1"
    }), context("folder-sections"));
    expect(response.status).toBe(201);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "읽을 글",
      folderId: "folder-1"
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty("sectionId");
  });

  it("forwards folder sectionId", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({
        id: "folder-1",
        name: "폴더",
        color: null,
        sectionId: "section-1",
        position: 0
      }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { PATCH } = await import("@/app/api/[resource]/[[...path]]/route");
    const response = await PATCH(request("/api/folders/folder-1", "PATCH", {
      name: "폴더",
      sectionId: "section-1"
    }), context("folders", ["folder-1"]));
    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ name: "폴더", sectionId: "section-1" });
  });

  it("accepts section POST without folderId", async () => {
    const created = { id: "section-1", name: "새 섹션", color: "#db2777", position: 0 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(created), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/[resource]/[[...path]]/route");
    const response = await POST(request("/api/sections", "POST", {
      name: "새 섹션",
      color: "#db2777"
    }), context("sections"));
    expect(response.status).toBe(201);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      name: "새 섹션",
      color: "#db2777"
    });
  });

  it("rejects folder movement on section PATCH", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { PATCH } = await import("@/app/api/[resource]/[[...path]]/route");
    const response = await PATCH(request("/api/sections/section-1", "PATCH", {
      folderId: "folder-2"
    }), context("sections", ["section-1"]));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps reorder validation and error envelope", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("@/app/api/[resource]/[[...path]]/route");
    const response = await POST(request("/api/folders/reorder", "POST", [{ id: "", position: -1 }]), context("folders", ["reorder"]));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toHaveProperty("detail");
  });

  it("returns 404 for reorder paths with extra segments", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/[resource]/[[...path]]/route");

    const response = await POST(
      request("/api/bookmarks/reorder/extra", "POST", []),
      context("bookmarks", ["reorder", "extra"])
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed PATCH bodies", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { PATCH } = await import("@/app/api/[resource]/[[...path]]/route");

    const response = await PATCH(
      request("/api/bookmarks/bookmark-1", "PATCH", { isFavorite: "yes" }),
      context("bookmarks", ["bookmark-1"])
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
