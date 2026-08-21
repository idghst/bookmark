import { afterEach, describe, expect, it, vi } from "vitest";

function configureRest() {
  vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com");
  vi.stubEnv("BOOKMARK_GRAPHQL_URL", "");
  vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("bookmarkStore REST transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("reads bookmarks through REST with the server key", async () => {
    configureRest();
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listBookmarks()).resolves.toEqual([]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.example.com/api/bookmarks");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("X-Bookmark-Key")).toBe("bookmark-api-secret");
  });

  it("returns the globally matching section instead of creating a duplicate", async () => {
    configureRest();
    const existing = { id: "section-basic", name: "기본", position: 0 };
    const fetchMock = vi.fn(async () => jsonResponse([existing]));
    vi.stubGlobal("fetch", fetchMock);
    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.createSection(" 기본 ")).resolves.toEqual(existing);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates a section without folderId", async () => {
    configureRest();
    const created = { id: "section-colored", name: "색상 섹션", color: "#db2777", position: 0 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(created, 201));
    vi.stubGlobal("fetch", fetchMock);
    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.createSection(" 색상 섹션 ", created.color)).resolves.toEqual(created);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      name: "색상 섹션",
      color: created.color
    });
  });

  it("patches a section without folder movement fields", async () => {
    configureRest();
    const updated = { id: "section-basic", name: "수정", color: "#16a34a", position: 0 };
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => jsonResponse(updated));
    vi.stubGlobal("fetch", fetchMock);
    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.updateSection("section-basic", { name: " 수정 ", color: "#16a34a" })).resolves.toEqual(updated);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ name: "수정", color: "#16a34a" });
    await expect(bookmarkStore.updateSection("section-basic", { folderId: "folder-2" })).rejects.toMatchObject({ status: 400 });
  });

  it("forwards folder sectionId and deletion destination", async () => {
    configureRest();
    const folder = { id: "folder-1", name: "폴더", color: "#4f46e5", sectionId: "section-1", position: 0 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(folder, 201))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await bookmarkStore.createFolder({ name: " 폴더 ", color: "#4f46e5", sectionId: " section-1 " });
    await bookmarkStore.deleteFolder("folder-1", "fallback-folder");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "폴더",
      color: "#4f46e5",
      sectionId: "section-1"
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain("destination_folder_id=fallback-folder");
  });

  it("lists and creates folder-owned sections without touching sidebar sections", async () => {
    configureRest();
    const created = {
      id: "folder-section-1",
      name: "읽을 글",
      color: null,
      folderId: "folder-1",
      position: 0
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(created, 201));
    vi.stubGlobal("fetch", fetchMock);
    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listFolderSections()).resolves.toEqual([]);
    await expect(bookmarkStore.createFolderSection({
      name: " 읽을 글 ",
      folderId: " folder-1 "
    })).resolves.toEqual(created);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.example.com/api/folder-sections");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      name: "읽을 글",
      folderId: "folder-1"
    });
  });

  it("normalizes bookmark URLs and rejects sectionId", async () => {
    configureRest();
    const bookmark = {
      id: "bookmark-1",
      title: "Example",
      url: "https://example.com/",
      description: null,
      isFavorite: false,
      folderId: "folder-1",
      position: 0
    };
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => jsonResponse(bookmark, 201));
    vi.stubGlobal("fetch", fetchMock);
    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await bookmarkStore.createBookmark({
      title: "Example",
      url: "example.com",
      description: null,
      isFavorite: false,
      folderId: "folder-1"
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).url).toBe("https://example.com/");
    await expect(bookmarkStore.createBookmark({ ...bookmark, sectionId: "old" })).rejects.toMatchObject({ status: 400 });
    await bookmarkStore.createBookmark({
      title: "Example",
      url: "https://example.com",
      description: null,
      isFavorite: false,
      folderId: "folder-1",
      folderSectionId: "folder-section-1"
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      folderId: "folder-1",
      folderSectionId: "folder-section-1"
    });
  });

  it("maps REST errors to StoreError", async () => {
    configureRest();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "Not found" }, 404)));
    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.deleteBookmark("missing")).rejects.toMatchObject({ message: "Not found", status: 404 });
  });

  it("deletes a section through REST", async () => {
    configureRest();
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 204 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await bookmarkStore.deleteSection("section-basic");

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.com/api/sections/section-basic"
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
  });

  it("requires REST server configuration before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listBookmarks()).rejects.toMatchObject({
      message: "BOOKMARK_API_URL and BOOKMARK_API_KEY are required.",
      status: 500
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("derives the REST base from the legacy GraphQL URL", async () => {
    vi.stubEnv("BOOKMARK_API_URL", "");
    vi.stubEnv("BOOKMARK_GRAPHQL_URL", "https://api.example.com/graphql");
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse([])
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listFolders()).resolves.toEqual([]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.example.com/api/folders");
  });

  it("removes a legacy /graphql suffix from BOOKMARK_API_URL", async () => {
    vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com/graphql");
    vi.stubEnv("BOOKMARK_GRAPHQL_URL", "");
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse([])
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listFolders()).resolves.toEqual([]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.example.com/api/folders");
  });

  it("rejects a malformed bookmark before making a request", async () => {
    configureRest();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.createBookmark({
        title: "Bad",
        url: "file:///etc/passwd",
        isFavorite: false,
        folderId: null
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves REST conflicts for optimistic mutation rollback", async () => {
    configureRest();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            code: "conflict",
            message: "Folder position conflict",
            request_id: "req-2"
          },
          409
        )
      )
    );

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.reorderFolders([{ id: "folder-1", position: 0 }])
    ).rejects.toMatchObject({
      message: "Folder position conflict",
      status: 409
    });
  });

  it("rejects malformed reorder data before forwarding", async () => {
    configureRest();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.reorderBookmarks([
        { id: "bookmark-a", position: 0 },
        { id: "bookmark-a", position: 1 }
      ])
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
