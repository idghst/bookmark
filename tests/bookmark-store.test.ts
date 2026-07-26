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
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
});
