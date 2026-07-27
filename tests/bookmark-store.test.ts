import { afterEach, describe, expect, it, vi } from "vitest";

function configureFastApi() {
  vi.stubEnv("BOOKMARK_API_URL", "https://api.example.com/");
  vi.stubEnv("BOOKMARK_API_KEY", "bookmark-api-secret");
}

describe("bookmarkStore FastAPI transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("reads bookmarks through FastAPI with the server key", async () => {
    configureFastApi();
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
        JSON.stringify([
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
        ]),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listBookmarks()).resolves.toHaveLength(1);

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.com/api/bookmarks"
    );
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("X-Bookmark-Key")).toBe("bookmark-api-secret");
    expect(headers.has("apikey")).toBe(false);
  });

  it("returns the same-folder section when its name already exists", async () => {
    configureFastApi();
    const existing = {
      id: "section-basic",
      name: "기본",
      folderId: "folder-1",
      position: 0
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([existing]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.createSection("folder-1", " 기본 ")
    ).resolves.toEqual(existing);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes a section through FastAPI", async () => {
    configureFastApi();
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(null, { status: 204 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await bookmarkStore.deleteSection("section-basic");

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.com/api/sections/section-basic"
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
  });

  it("requires FastAPI server configuration before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listBookmarks()).rejects.toMatchObject({
      message: "BOOKMARK_API_URL and BOOKMARK_API_KEY are required.",
      status: 500
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed bookmark before making a request", async () => {
    configureFastApi();
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

  it("normalizes bookmark URLs before forwarding writes", async () => {
    configureFastApi();
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
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(bookmark), { status: 201 })
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

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      url: "https://example.com/"
    });
  });

  it("surfaces FastAPI errors without leaking transport details", async () => {
    configureFastApi();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            code: "resource_not_found",
            message: "Bookmark not found",
            request_id: "req-1"
          }),
          { status: 404 }
        )
      )
    );

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.deleteBookmark("missing")).rejects.toMatchObject({
      message: "Bookmark not found",
      status: 404
    });
  });

  it("rejects malformed reorder data before forwarding", async () => {
    configureFastApi();
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
