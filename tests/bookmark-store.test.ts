import { afterEach, describe, expect, it, vi } from "vitest";

function configureGraphql() {
  vi.stubEnv(
    "BOOKMARK_GRAPHQL_URL",
    "https://graphql.example.com/api/graphql"
  );
  vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
}

function graphqlResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("bookmarkStore GraphQL transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("reads bookmarks through GraphQL with the server key", async () => {
    configureGraphql();
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) =>
      graphqlResponse({
        bookmarks: [
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
        ]
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listBookmarks()).resolves.toHaveLength(1);

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://graphql.example.com/api/graphql"
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("X-Bookmark-Key")).toBe("bookmark-api-secret");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.query).toContain("bookmarks");
    expect(body.variables).toEqual({});
  });

  it("returns the same-folder section when its name already exists", async () => {
    configureGraphql();
    const existing = {
      id: "section-basic",
      name: "기본",
      folderId: "folder-1",
      position: 0
    };
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) =>
      graphqlResponse({ sections: [existing] })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.createSection("folder-1", " 기본 ")
    ).resolves.toEqual(existing);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes a section through GraphQL", async () => {
    configureGraphql();
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) =>
      graphqlResponse({ deleteSection: true })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await bookmarkStore.deleteSection("section-basic");

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.query).toContain("deleteSection");
    expect(body.variables).toEqual({ id: "section-basic" });
  });

  it("updates a section through GraphQL", async () => {
    configureGraphql();
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
    ) => graphqlResponse({ updateSection: updated }));
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

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.query).toContain("updateSection");
    expect(body.variables).toEqual({
      id: "section-basic",
      input: { name: "수정된 기본", color: "#16a34a", folderId: "folder-2" }
    });
  });

  it("creates a section with its color through GraphQL", async () => {
    configureGraphql();
    const created = {
      id: "section-colored",
      name: "색상 섹션",
      color: "#db2777",
      folderId: "folder-1",
      position: 0
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(graphqlResponse({ sections: [] }))
      .mockResolvedValueOnce(graphqlResponse({ createSection: created }));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.createSection("folder-1", " 색상 섹션 ", created.color)
    ).resolves.toEqual(created);

    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.query).toContain("createSection");
    expect(body.variables).toEqual({
      input: { folderId: "folder-1", name: "색상 섹션", color: created.color }
    });
  });

  it("requires GraphQL server configuration before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listBookmarks()).rejects.toMatchObject({
      message: "BOOKMARK_GRAPHQL_URL and BOOKMARK_API_KEY are required.",
      status: 500
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a legacy BOOKMARK_API_URL base as the GraphQL endpoint", async () => {
    vi.stubEnv("BOOKMARK_GRAPHQL_URL", "");
    vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com/");
    vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) => graphqlResponse({ folders: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listFolders()).resolves.toEqual([]);

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.example.com/graphql");
  });

  it("rejects a malformed bookmark before making a request", async () => {
    configureGraphql();
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

  it("normalizes bookmark URLs in GraphQL variables", async () => {
    configureGraphql();
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
    ) =>
      graphqlResponse({ createBookmark: bookmark })
    );
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
    expect(body.variables.input.url).toBe("https://example.com/");
  });

  it("forwards folder parentId and deletion destination through GraphQL", async () => {
    configureGraphql();
    const folder = {
      id: "child-folder",
      name: "하위 폴더",
      color: "#4f46e5",
      parentId: "root-folder",
      position: 0
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(graphqlResponse({ createFolder: folder }))
      .mockResolvedValueOnce(graphqlResponse({ deleteFolder: true }));
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

    const createBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(createBody.query).toContain("parentId");
    expect(createBody.variables).toEqual({
      input: { name: "하위 폴더", color: "#4f46e5", parentId: "root-folder" }
    });
    const deleteBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(deleteBody.query).toContain("destinationFolderId");
    expect(deleteBody.variables).toEqual({
      id: "child-folder",
      destinationFolderId: "fallback-folder"
    });
  });

  it("maps GraphQL errors to the existing store error contract", async () => {
    configureGraphql();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: null,
            errors: [
              {
                message: "Not found",
                extensions: { code: "NOT_FOUND" }
              }
            ]
          }),
          { status: 200 }
        )
      )
    );

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.deleteBookmark("missing")).rejects.toMatchObject({
      message: "Not found",
      status: 404
    });
  });

  it("preserves GraphQL conflicts for optimistic mutation rollback", async () => {
    configureGraphql();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: null,
            errors: [
              {
                message: "Folder structure contains a cycle",
                extensions: { code: "CONFLICT" }
              }
            ]
          }),
          { status: 200 }
        )
      )
    );

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.reorderFolders([{ id: "folder-1", position: 0 }])).rejects.toMatchObject({
      message: "Folder structure contains a cycle",
      status: 409
    });
  });

  it("rejects malformed reorder data before forwarding", async () => {
    configureGraphql();
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
