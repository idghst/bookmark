import { afterEach, describe, expect, it, vi } from "vitest";

function configureRest() {
  vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com");
  vi.stubEnv("BOOKMARK_GRAPHQL_URL", "");
  vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("bookmarkStore REST transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("reads bookmarks through REST with the server key", async () => {
    configureRest();
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) =>
      jsonResponse([
        {
          id: "bookmark-1",
          title: "Example",
          url: "https://example.com",
          description: null,
          isFavorite: false,
          folderId: null,
          sectionId: null,
          position: 0
        }
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listBookmarks()).resolves.toHaveLength(1);

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.com/api/bookmarks"
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("GET");
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("X-Bookmark-Key")).toBe("bookmark-api-secret");
    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
  });

  it("returns the same-folder section when its name already exists", async () => {
    configureRest();
    const existing = {
      id: "section-basic",
      name: "기본",
      folderId: "folder-1",
      position: 0
    };
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) => jsonResponse([existing]));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.createSection("folder-1", " 기본 ")
    ).resolves.toEqual(existing);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes a section through REST", async () => {
    configureRest();
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await bookmarkStore.deleteSection("section-basic");

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.com/api/sections/section-basic"
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
  });

  it("validates and updates a section through REST", async () => {
    configureRest();
    const updated = {
      id: "section-basic",
      name: "수정된 기본",
      color: "#16a34a",
      folderId: "folder-2",
      position: 0
    };
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) => jsonResponse(updated));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.updateSection("section-basic", " 수정된 기본 ")
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      bookmarkStore.updateSection("section-basic", {
        name: " 수정된 기본 ",
        color: "#16a34a",
        folderId: "folder-2"
      })
    ).resolves.toEqual(updated);

    expect(fetchMock.mock.calls[0][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "수정된 기본",
      color: "#16a34a",
      folderId: "folder-2"
    });
  });

  it("creates a section with its color through REST", async () => {
    configureRest();
    const created = {
      id: "section-colored",
      name: "색상 섹션",
      color: "#db2777",
      folderId: "folder-1",
      position: 0
    };
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(created, 201));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.createSection("folder-1", " 색상 섹션 ", created.color)
    ).resolves.toEqual(created);

    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      folderId: "folder-1",
      name: "색상 섹션",
      color: created.color
    });
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
    vi.stubEnv(
      "BOOKMARK_GRAPHQL_URL",
      "https://api.example.com/graphql"
    );
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listFolders()).resolves.toEqual([]);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.com/api/folders"
    );
  });

  it("removes a legacy /graphql suffix from BOOKMARK_API_URL", async () => {
    vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com/graphql");
    vi.stubEnv("BOOKMARK_GRAPHQL_URL", "");
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listFolders()).resolves.toEqual([]);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.com/api/folders"
    );
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
        folderId: null,
        sectionId: null
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes bookmark URLs in REST bodies", async () => {
    configureRest();
    const bookmark = {
      id: "bookmark-1",
      title: "Example",
      url: "https://example.com/",
      description: null,
      isFavorite: false,
      folderId: null,
      sectionId: null,
      position: 0
    };
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) => jsonResponse(bookmark, 201));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await bookmarkStore.createBookmark({
      title: "Example",
      url: "example.com",
      description: null,
      isFavorite: false,
      folderId: null,
      sectionId: null
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.url).toBe("https://example.com/");
  });

  it("forwards folder parentId and deletion destination through REST", async () => {
    configureRest();
    const folder = {
      id: "child-folder",
      name: "하위 폴더",
      color: "#4f46e5",
      parentId: "root-folder",
      position: 0
    };
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse(folder, 201))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.createFolder({
        name: " 하위 폴더 ",
        color: "#4f46e5",
        parentId: " root-folder "
      })
    ).resolves.toEqual(folder);
    await bookmarkStore.deleteFolder("child-folder", "fallback-folder");

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "하위 폴더",
      color: "#4f46e5",
      parentId: "root-folder"
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://api.example.com/api/folders/child-folder?destination_folder_id=fallback-folder"
    );
  });

  it("maps REST errors to the existing store error contract", async () => {
    configureRest();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { code: "not_found", message: "Not found", request_id: "req-1" },
          404
        )
      )
    );

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.deleteBookmark("missing")).rejects.toMatchObject({
      message: "Not found",
      status: 404
    });
  });

  it("preserves REST conflicts for optimistic mutation rollback", async () => {
    configureRest();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            code: "conflict",
            message: "Folder structure contains a cycle",
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
      message: "Folder structure contains a cycle",
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
