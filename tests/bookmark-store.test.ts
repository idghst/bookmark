import { afterEach, describe, expect, it, vi } from "vitest";

describe("bookmarkStore.createSection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns the same-folder section when its name already exists", async () => {
    vi.stubEnv("BOOKMARK_USER_ID", "user-1");
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", "sb_secret_test");
    const existing = {
      id: "section-basic",
      user_id: "user-1",
      name: "기본",
      folder_id: "folder-1",
      position: 0
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: "folder-1", user_id: "user-1", name: "작업", color: null, position: 0 }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([existing]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.createSection("folder-1", " 기본 ")).resolves.toEqual({
      id: existing.id,
      name: existing.name,
      folderId: existing.folder_id,
      position: existing.position
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("GET");
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("Accept-Profile")).toBe("bookmark");
    expect(headers.get("apikey")).toBe("sb_secret_test");
    expect(headers.has("Authorization")).toBe(false);
  });

  it("unassigns bookmarks before deleting a section", async () => {
    vi.stubEnv("BOOKMARK_USER_ID", "user-1");
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", "sb_secret_test");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await bookmarkStore.deleteSection("section-basic");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const unassignUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(unassignUrl.pathname).toBe("/rest/v1/items");
    expect(unassignUrl.searchParams.get("section_id")).toBe("eq.section-basic");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ section_id: null });
    const updateHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(updateHeaders.get("Content-Profile")).toBe("bookmark");
    expect(updateHeaders.get("apikey")).toBe("sb_secret_test");
    expect(updateHeaders.has("Authorization")).toBe(false);

    const deleteUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(deleteUrl.pathname).toBe("/rest/v1/sections");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("DELETE");
  });

  it("requires BOOKMARK_USER_ID before making a Supabase request", async () => {
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", "sb_secret_test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(bookmarkStore.listBookmarks()).rejects.toMatchObject({
      message: "BOOKMARK_USER_ID is required.",
      status: 500
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a direct malformed bookmark body before making a request", async () => {
    vi.stubEnv("BOOKMARK_USER_ID", "user-1");
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", "sb_secret_test");
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

  it("rejects a folder reference outside the configured owner", async () => {
    vi.stubEnv("BOOKMARK_USER_ID", "user-1");
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", "sb_secret_test");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify([]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.createBookmark({
        title: "Example",
        url: "https://example.com",
        isFavorite: false,
        folderId: "other-owner-folder",
        sectionId: null
      })
    ).rejects.toMatchObject({ status: 400 });

    const lookup = new URL(String(fetchMock.mock.calls[0][0]));
    expect(lookup.pathname).toBe("/rest/v1/folders");
    expect(lookup.searchParams.get("user_id")).toBe("eq.user-1");
  });

  it("rejects a section that does not belong to the bookmark folder", async () => {
    vi.stubEnv("BOOKMARK_USER_ID", "user-1");
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", "sb_secret_test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: "folder-1", user_id: "user-1", name: "One", color: null, position: 0 }]),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: "section-2", user_id: "user-1", name: "Two", folder_id: "folder-2", position: 0 }]),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.createBookmark({
        title: "Example",
        url: "https://example.com",
        isFavorite: false,
        folderId: "folder-1",
        sectionId: "section-2"
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("restores every original position after a partial reorder failure", async () => {
    vi.stubEnv("BOOKMARK_USER_ID", "user-1");
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", "sb_secret_test");
    const originalRows = [
      { id: "bookmark-a", position: 0 },
      { id: "bookmark-b", position: 1 }
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(originalRows), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "write failed" }), { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.reorderBookmarks([
        { id: "bookmark-a", position: 1 },
        { id: "bookmark-b", position: 0 }
      ])
    ).rejects.toMatchObject({ message: "write failed", status: 500 });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const requests = fetchMock.mock.calls.map(([input, init]) => ({
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : null,
      user: new URL(String(input)).searchParams.get("user_id")
    }));
    expect(requests).toMatchObject([
      { method: "GET", user: "eq.user-1" },
      { method: "PATCH", body: { position: 1 }, user: "eq.user-1" },
      { method: "PATCH", body: { position: 0 }, user: "eq.user-1" },
      { method: "PATCH", body: { position: 0 }, user: "eq.user-1" },
      { method: "PATCH", body: { position: 1 }, user: "eq.user-1" }
    ]);
  });

  it("rejects reorder IDs outside the configured owner before writing", async () => {
    vi.stubEnv("BOOKMARK_USER_ID", "user-1");
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", "sb_secret_test");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ id: "bookmark-a", position: 0 }]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookmarkStore } = await import("@/app/lib/bookmarks/store");
    await expect(
      bookmarkStore.reorderBookmarks([
        { id: "bookmark-a", position: 1 },
        { id: "other-owner-bookmark", position: 0 }
      ])
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
