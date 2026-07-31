import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BookmarksPage from "@/app/(dashboard)/page";
import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";

let remoteSnapshot: {
  bookmarks: BookmarkItem[];
  sections: Section[];
  folders: Folder[];
};

function stubBookmarkCache(
  bookmarks: BookmarkItem[] = [],
  sections: Section[] = [],
  folders: Folder[] = [{ id: "work", name: "작업", color: "#4f46e5", position: 0 }]
) {
  remoteSnapshot = { bookmarks, sections, folders };
  const cache = JSON.stringify({
    version: 1,
    apiBacked: true,
    savedAt: Date.now(),
    folders,
    sections,
    bookmarks,
    selectedFolderId: "work"
  });
  const setItem = vi.fn();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: vi.fn(() => cache),
      setItem,
      removeItem: vi.fn()
    }
  });
  return { setItem };
}

function stubRemote(
  mutation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (method === "GET" && path === "/api/folders") {
      return new Response(JSON.stringify(remoteSnapshot.folders), { status: 200 });
    }
    if (method === "GET" && path === "/api/sections") {
      return new Response(JSON.stringify(remoteSnapshot.sections), { status: 200 });
    }
    if (method === "GET" && path === "/api/bookmarks") {
      return new Response(JSON.stringify(remoteSnapshot.bookmarks), { status: 200 });
    }
    return mutation(input, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mutationCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");
}

describe("bookmark database saving feedback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("portals the modal overlay to the viewport layer", async () => {
    stubBookmarkCache();
    render(<BookmarksPage />);

    const addButtons = await screen.findAllByRole("button", { name: "북마크 추가" });
    fireEvent.click(addButtons[0]);

    expect(screen.getByRole("dialog").parentElement).toBe(document.body);
  });

  it("paints cache immediately and replaces it with a successful remote refresh", async () => {
    const { setItem } = stubBookmarkCache([
      {
        id: "cached",
        title: "Cached",
        url: "https://cached.example.com",
        description: null,
        isFavorite: false,
        folderId: "work",
        sectionId: null,
        position: 0
      }
    ]);
    let resolveFolders!: (response: Response) => void;
    let resolveSections!: (response: Response) => void;
    let resolveBookmarks!: (response: Response) => void;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/folders") {
        return new Promise<Response>((resolve) => {
          resolveFolders = resolve;
        });
      }
      if (String(input) === "/api/sections") {
        return new Promise<Response>((resolve) => {
          resolveSections = resolve;
        });
      }
      return new Promise<Response>((resolve) => {
        resolveBookmarks = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    expect(await screen.findByRole("link", { name: /Cached/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await act(async () => {
      resolveFolders(new Response(JSON.stringify(remoteSnapshot.folders), { status: 200 }));
      resolveSections(new Response(JSON.stringify([]), { status: 200 }));
      resolveBookmarks(
        new Response(
          JSON.stringify([
            {
              id: "remote",
              title: "Remote",
              url: "https://remote.example.com",
              description: null,
              isFavorite: false,
              folderId: "work",
              sectionId: null,
              position: 0
            }
          ]),
          { status: 200 }
        )
      );
    });

    expect(await screen.findByRole("link", { name: /Remote/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Cached/ })).not.toBeInTheDocument();
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved).toMatchObject({
        apiBacked: true,
        bookmarks: [{ id: "remote", title: "Remote" }]
      });
    });
  });

  it("keeps cache on remote failure and does not trust cached apiBacked", async () => {
    const { setItem } = stubBookmarkCache([
      {
        id: "cached",
        title: "Cached",
        url: "https://cached.example.com",
        description: null,
        isFavorite: false,
        folderId: "work",
        sectionId: null,
        position: 0
      }
    ]);
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    expect(await screen.findByRole("link", { name: /Cached/ })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved).toMatchObject({
        apiBacked: false,
        bookmarks: [{ id: "cached", title: "Cached" }]
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Cached 즐겨찾기" }));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: "Cached 즐겨찾기" }).querySelector("svg")).toHaveClass(
      "fill-[var(--color-brand)]"
    );
  });

  it("blocks cached mutation controls until the initial remote bootstrap succeeds", async () => {
    const section = { id: "section-a", name: "기본", folderId: "work", position: 0 } satisfies Section;
    const bookmark = {
      id: "bm-1",
      title: "Example",
      url: "https://example.com",
      description: null,
      isFavorite: false,
      folderId: "work",
      sectionId: section.id,
      position: 0
    } satisfies BookmarkItem;
    const { setItem } = stubBookmarkCache([bookmark], [section]);
    const resolvers = new Map<string, (response: Response) => void>();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if ((init?.method ?? "GET") === "GET") {
        return new Promise<Response>((resolve) => {
          resolvers.set(path, resolve);
        });
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ...bookmark, isFavorite: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    const card = await screen.findByRole("link", { name: /Example/ });
    const favorite = screen.getByRole("button", { name: "Example 즐겨찾기" });
    expect(screen.getByRole("main").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
    expect(card).toHaveAttribute("draggable", "false");
    expect(favorite).toBeDisabled();
    expect(screen.getByRole("button", { name: "Example 편집" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Example 삭제" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "기본 섹션 삭제" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "기본 섹션 순서 변경" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "작업 편집" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "작업 삭제" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "새 폴더" })).toBeDisabled();
    screen.getAllByRole("button", { name: "북마크 추가" }).forEach((button) => {
      expect(button).toBeDisabled();
    });

    fireEvent.click(favorite);
    fireEvent.click(screen.getAllByRole("button", { name: "북마크 추가" })[0]);
    expect(mutationCalls(fetchMock)).toHaveLength(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(favorite.querySelector("svg")).not.toHaveClass("fill-[var(--color-brand)]");
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.bookmarks[0]).toMatchObject({ id: "bm-1", isFavorite: false });
    });

    await act(async () => {
      resolvers.get("/api/folders")?.(
        new Response(JSON.stringify(remoteSnapshot.folders), { status: 200 })
      );
      resolvers.get("/api/sections")?.(
        new Response(JSON.stringify(remoteSnapshot.sections), { status: 200 })
      );
      resolvers.get("/api/bookmarks")?.(
        new Response(JSON.stringify(remoteSnapshot.bookmarks), { status: 200 })
      );
    });

    await waitFor(() => expect(favorite).toBeEnabled());
    expect(screen.getByRole("main").closest("[aria-busy]")).toHaveAttribute("aria-busy", "false");
    expect(card).toHaveAttribute("draggable", "true");
    fireEvent.click(favorite);
    await waitFor(() => expect(mutationCalls(fetchMock)).toHaveLength(1));
  });

  it("unlocks local fallback mutations after the initial remote bootstrap fails", async () => {
    const bookmark = {
      id: "bm-1",
      title: "Example",
      url: "https://example.com",
      description: null,
      isFavorite: false,
      folderId: "work",
      sectionId: null,
      position: 0
    } satisfies BookmarkItem;
    const { setItem } = stubBookmarkCache([bookmark]);
    const resolvers: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        return new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        });
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    const favorite = await screen.findByRole("button", { name: "Example 즐겨찾기" });
    expect(favorite).toBeDisabled();
    fireEvent.click(favorite);
    expect(mutationCalls(fetchMock)).toHaveLength(0);
    expect(favorite.querySelector("svg")).not.toHaveClass("fill-[var(--color-brand)]");

    await act(async () => {
      resolvers.forEach((resolve) =>
        resolve(
          new Response(JSON.stringify({ detail: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
          })
        )
      );
    });

    await waitFor(() => expect(favorite).toBeEnabled());
    fireEvent.click(favorite);
    expect(mutationCalls(fetchMock)).toHaveLength(0);
    expect(favorite.querySelector("svg")).toHaveClass("fill-[var(--color-brand)]");
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.bookmarks[0]).toMatchObject({ id: "bm-1", isFavorite: true });
    });
  });

  it("opens folder choices above the bookmark modal", async () => {
    stubBookmarkCache();
    render(<BookmarksPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: "북마크 추가" }))[0]);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "폴더" }), { key: "ArrowDown" });

    expect(await screen.findByRole("listbox")).toHaveClass("z-[80]");
  });

  it("does not move a bookmark across section boundaries", async () => {
    const sections: Section[] = [
      { id: "section-a", name: "기본", folderId: "work", position: 0 },
      { id: "section-b", name: "메일", folderId: "work", position: 1 }
    ];
    stubBookmarkCache(
      [
        { id: "bm-a", title: "첫 북마크", url: "https://a.example.com", description: null, isFavorite: false, folderId: "work", sectionId: "section-a", position: 0 },
        { id: "bm-b", title: "둘째 북마크", url: "https://b.example.com", description: null, isFavorite: false, folderId: "work", sectionId: "section-b", position: 1 }
      ],
      sections
    );
    const fetchMock = stubRemote(async () => new Response(null, { status: 204 }));
    render(<BookmarksPage />);

    const first = await screen.findByRole("link", { name: /첫 북마크/ });
    const second = screen.getByRole("link", { name: /둘째 북마크/ });
    fireEvent.dragStart(first);
    fireEvent.dragOver(second);
    fireEvent.drop(second);

    expect(mutationCalls(fetchMock)).toHaveLength(0);
  });

  it("reorders bookmarks inside the same section", async () => {
    const section = { id: "section-a", name: "기본", folderId: "work", position: 0 } satisfies Section;
    stubBookmarkCache(
      [
        { id: "bm-a", title: "첫 북마크", url: "https://a.example.com", description: null, isFavorite: false, folderId: "work", sectionId: section.id, position: 0 },
        { id: "bm-b", title: "둘째 북마크", url: "https://b.example.com", description: null, isFavorite: false, folderId: "work", sectionId: section.id, position: 1 }
      ],
      [section]
    );
    const fetchMock = stubRemote(async () => new Response(null, { status: 204 }));
    render(<BookmarksPage />);

    fireEvent.dragStart(await screen.findByRole("link", { name: /첫 북마크/ }));
    const second = screen.getByRole("link", { name: /둘째 북마크/ });
    fireEvent.dragOver(second);
    fireEvent.drop(second);

    await waitFor(() => expect(mutationCalls(fetchMock)).toHaveLength(1));
    expect(mutationCalls(fetchMock)[0][0]).toBe("/api/bookmarks/reorder");
    expect(JSON.parse(String(mutationCalls(fetchMock)[0][1]?.body))).toEqual([
      { id: "bm-b", position: 0 },
      { id: "bm-a", position: 1 }
    ]);
  });

  it("rolls back bookmark order and cache when reorder saving fails", async () => {
    const section = { id: "section-a", name: "기본", folderId: "work", position: 0 } satisfies Section;
    const bookmarks: BookmarkItem[] = [
      { id: "bm-a", title: "첫 북마크", url: "https://a.example.com", description: null, isFavorite: false, folderId: "work", sectionId: section.id, position: 0 },
      { id: "bm-b", title: "둘째 북마크", url: "https://b.example.com", description: null, isFavorite: false, folderId: "work", sectionId: section.id, position: 1 }
    ];
    const { setItem } = stubBookmarkCache(bookmarks, [section]);
    stubRemote(
      async () =>
        new Response(JSON.stringify({ detail: "순서 저장에 실패했습니다." }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        })
    );
    render(<BookmarksPage />);

    fireEvent.dragStart(await screen.findByRole("link", { name: /첫 북마크/ }));
    const second = screen.getByRole("link", { name: /둘째 북마크/ });
    fireEvent.dragOver(second);
    fireEvent.drop(second);

    expect(await screen.findByRole("alert")).toHaveTextContent("순서 저장에 실패했습니다.");
    expect(
      screen.getByRole("link", { name: /첫 북마크/ }).compareDocumentPosition(
        screen.getByRole("link", { name: /둘째 북마크/ })
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.bookmarks).toMatchObject([
        { id: "bm-a", position: 0 },
        { id: "bm-b", position: 1 }
      ]);
    });
  });

  it("rolls back folder order and cache when reorder saving fails", async () => {
    const folders: Folder[] = [
      { id: "work", name: "작업", color: "#4f46e5", position: 0 },
      { id: "docs", name: "문서", color: "#2166d7", position: 1 }
    ];
    const { setItem } = stubBookmarkCache([], [], folders);
    stubRemote(
      async () =>
        new Response(JSON.stringify({ detail: "폴더 순서 저장에 실패했습니다." }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        })
    );
    render(<BookmarksPage />);

    const folderNavigation = await screen.findByRole("navigation", { name: "북마크 폴더" });
    const work = within(folderNavigation).getByRole("button", { name: "작업 0" });
    const docs = within(folderNavigation).getByRole("button", { name: "문서 0" });
    fireEvent.dragStart(work);
    fireEvent.dragOver(docs);
    fireEvent.drop(docs);

    expect(await screen.findByRole("alert")).toHaveTextContent("폴더 순서 저장에 실패했습니다.");
    expect(work.compareDocumentPosition(docs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.folders).toMatchObject([
        { id: "work", position: 0 },
        { id: "docs", position: 1 }
      ]);
    });
  });

  it("rolls back section order and cache when reorder saving fails", async () => {
    const sections: Section[] = [
      { id: "section-a", name: "기본", folderId: "work", position: 0 },
      { id: "section-b", name: "메일", folderId: "work", position: 1 }
    ];
    const bookmarks: BookmarkItem[] = [
      { id: "bm-a", title: "첫 북마크", url: "https://a.example.com", description: null, isFavorite: false, folderId: "work", sectionId: "section-a", position: 0 },
      { id: "bm-b", title: "둘째 북마크", url: "https://b.example.com", description: null, isFavorite: false, folderId: "work", sectionId: "section-b", position: 1 }
    ];
    const { setItem } = stubBookmarkCache(bookmarks, sections);
    stubRemote(
      async () =>
        new Response(JSON.stringify({ detail: "섹션 순서 저장에 실패했습니다." }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        })
    );
    render(<BookmarksPage />);

    const first = await screen.findByRole("heading", { name: "기본" });
    const second = screen.getByRole("heading", { name: "메일" });
    fireEvent.dragStart(first);
    fireEvent.dragOver(second);
    fireEvent.drop(second);

    expect(await screen.findByRole("alert")).toHaveTextContent("섹션 순서 저장에 실패했습니다.");
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.sections).toMatchObject([
        { id: "section-a", position: 0 },
        { id: "section-b", position: 1 }
      ]);
    });
  });

  it("rolls back favorite state and cache when saving fails", async () => {
    const bookmark = {
      id: "bm-1",
      title: "Example",
      url: "https://example.com",
      description: null,
      isFavorite: false,
      folderId: "work",
      sectionId: null,
      position: 0
    } satisfies BookmarkItem;
    const { setItem } = stubBookmarkCache([bookmark]);
    stubRemote(
      async () =>
        new Response(JSON.stringify({ detail: "즐겨찾기 저장에 실패했습니다." }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        })
    );
    render(<BookmarksPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Example 즐겨찾기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("즐겨찾기 저장에 실패했습니다.");
    expect(screen.getByRole("button", { name: "Example 즐겨찾기" }).querySelector("svg")).not.toHaveClass(
      "fill-[var(--color-brand)]"
    );
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.bookmarks[0]).toMatchObject({ id: "bm-1", isFavorite: false });
    });
  });

  it("preserves a later successful favorite change when an earlier request fails", async () => {
    const first = {
      id: "bm-a",
      title: "First",
      url: "https://a.example.com",
      description: null,
      isFavorite: false,
      folderId: "work",
      sectionId: null,
      position: 0
    } satisfies BookmarkItem;
    const second = {
      id: "bm-b",
      title: "Second",
      url: "https://b.example.com",
      description: null,
      isFavorite: false,
      folderId: "work",
      sectionId: null,
      position: 1
    } satisfies BookmarkItem;
    const { setItem } = stubBookmarkCache([first, second]);
    let failFirst!: (response: Response) => void;
    const firstRequest = new Promise<Response>((resolve) => {
      failFirst = resolve;
    });
    stubRemote(
      (input: RequestInfo | URL) =>
        String(input).endsWith("/bm-a")
          ? firstRequest
          : Promise.resolve(
              new Response(JSON.stringify({ ...second, isFavorite: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
              })
            )
    );
    render(<BookmarksPage />);

    fireEvent.click(await screen.findByRole("button", { name: "First 즐겨찾기" }));
    fireEvent.click(screen.getByRole("button", { name: "Second 즐겨찾기" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Second 즐겨찾기" }).querySelector("svg")).toHaveClass(
        "fill-[var(--color-brand)]"
      )
    );

    await act(async () => {
      failFirst(
        new Response(JSON.stringify({ detail: "첫 즐겨찾기 저장에 실패했습니다." }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        })
      );
      await firstRequest;
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("첫 즐겨찾기 저장에 실패했습니다.");
    expect(screen.getByRole("button", { name: "First 즐겨찾기" }).querySelector("svg")).not.toHaveClass(
      "fill-[var(--color-brand)]"
    );
    expect(screen.getByRole("button", { name: "Second 즐겨찾기" }).querySelector("svg")).toHaveClass(
      "fill-[var(--color-brand)]"
    );
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.bookmarks).toMatchObject([
        { id: "bm-a", isFavorite: false },
        { id: "bm-b", isFavorite: true }
      ]);
    });
  });

  it("serializes two favorite changes for the same bookmark", async () => {
    const bookmark = {
      id: "bm-1",
      title: "Example",
      url: "https://example.com",
      description: null,
      isFavorite: false,
      folderId: "work",
      sectionId: null,
      position: 0
    } satisfies BookmarkItem;
    stubBookmarkCache([bookmark]);
    let finishFirst!: (response: Response) => void;
    const firstRequest = new Promise<Response>((resolve) => {
      finishFirst = resolve;
    });
    let patchCount = 0;
    const fetchMock = stubRemote(async () => {
      patchCount += 1;
      return patchCount === 1
        ? firstRequest
        : new Response(JSON.stringify(bookmark), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
    });
    render(<BookmarksPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByRole("button", { name: "Example 즐겨찾기" }));
    await waitFor(() => expect(mutationCalls(fetchMock)).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Example 즐겨찾기" }));
    await act(async () => Promise.resolve());
    expect(mutationCalls(fetchMock)).toHaveLength(1);

    await act(async () => {
      finishFirst(
        new Response(JSON.stringify({ ...bookmark, isFavorite: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
      await firstRequest;
    });

    await waitFor(() => expect(mutationCalls(fetchMock)).toHaveLength(2));
    expect(mutationCalls(fetchMock).map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { isFavorite: true },
      { isFavorite: false }
    ]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Example 즐겨찾기" }).querySelector("svg")).not.toHaveClass(
        "fill-[var(--color-brand)]"
      )
    );
  });

  it.each([
    {
      label: "both requests fail",
      outcomes: [false, false],
      expectedFavorite: false,
      expectedOrder: [
        "PATCH true",
        "GET /api/folders",
        "GET /api/sections",
        "GET /api/bookmarks",
        "PATCH false",
        "GET /api/folders",
        "GET /api/sections",
        "GET /api/bookmarks"
      ]
    },
    {
      label: "only the first request succeeds",
      outcomes: [true, false],
      expectedFavorite: true,
      expectedOrder: [
        "PATCH true",
        "PATCH false",
        "GET /api/folders",
        "GET /api/sections",
        "GET /api/bookmarks"
      ]
    },
    {
      label: "only the second request succeeds",
      outcomes: [false, true],
      expectedFavorite: false,
      expectedOrder: [
        "PATCH true",
        "GET /api/folders",
        "GET /api/sections",
        "GET /api/bookmarks",
        "PATCH false"
      ]
    },
    {
      label: "both requests succeed",
      outcomes: [true, true],
      expectedFavorite: false,
      expectedOrder: ["PATCH true", "PATCH false"]
    }
  ])(
    "reconciles queued favorite toggles with canonical state when $label",
    async ({ outcomes, expectedFavorite, expectedOrder }) => {
      const bookmark = {
        id: "bm-1",
        title: "Example",
        url: "https://example.com",
        description: null,
        isFavorite: false,
        folderId: "work",
        sectionId: null,
        position: 0
      } satisfies BookmarkItem;
      const { setItem } = stubBookmarkCache([bookmark]);
      let canonicalFavorite = false;
      let patchIndex = 0;
      const requestOrder: string[] = [];
      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        const method = init?.method ?? "GET";
        if (method === "GET") {
          requestOrder.push(`GET ${path}`);
          if (path === "/api/folders") {
            return new Response(JSON.stringify(remoteSnapshot.folders), { status: 200 });
          }
          if (path === "/api/sections") {
            return new Response(JSON.stringify(remoteSnapshot.sections), { status: 200 });
          }
          return new Response(
            JSON.stringify([{ ...bookmark, isFavorite: canonicalFavorite }]),
            { status: 200 }
          );
        }

        const target = JSON.parse(String(init?.body)).isFavorite as boolean;
        requestOrder.push(`PATCH ${target}`);
        const succeeds = outcomes[patchIndex];
        patchIndex += 1;
        if (!succeeds) {
          return new Response(JSON.stringify({ detail: "즐겨찾기 저장에 실패했습니다." }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
        canonicalFavorite = target;
        return new Response(JSON.stringify({ ...bookmark, isFavorite: target }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      });
      vi.stubGlobal("fetch", fetchMock);
      render(<BookmarksPage />);

      const favorite = await screen.findByRole("button", { name: "Example 즐겨찾기" });
      await waitFor(() => expect(favorite).toBeEnabled());
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
      requestOrder.length = 0;

      fireEvent.click(favorite);
      fireEvent.click(favorite);

      await waitFor(() => expect(patchIndex).toBe(2));
      await waitFor(() => expect(requestOrder).toEqual(expectedOrder));
      await waitFor(() => {
        if (expectedFavorite) {
          expect(favorite.querySelector("svg")).toHaveClass("fill-[var(--color-brand)]");
        } else {
          expect(favorite.querySelector("svg")).not.toHaveClass("fill-[var(--color-brand)]");
        }
      });
      await waitFor(() => {
        const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
        expect(saved.bookmarks[0]).toMatchObject({
          id: "bm-1",
          isFavorite: expectedFavorite
        });
      });
    }
  );

  it("refreshes canonical remote data after reorder failure", async () => {
    const section = { id: "section-a", name: "기본", folderId: "work", position: 0 } satisfies Section;
    const cached: BookmarkItem[] = [
      { id: "bm-a", title: "캐시 첫", url: "https://a.example.com", description: null, isFavorite: false, folderId: "work", sectionId: section.id, position: 0 },
      { id: "bm-b", title: "캐시 둘", url: "https://b.example.com", description: null, isFavorite: false, folderId: "work", sectionId: section.id, position: 1 }
    ];
    stubBookmarkCache(cached, [section]);
    let bookmarkReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if ((init?.method ?? "GET") === "POST") {
        return new Response(JSON.stringify({ detail: "순서 저장 실패" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (path === "/api/folders") return new Response(JSON.stringify(remoteSnapshot.folders), { status: 200 });
      if (path === "/api/sections") return new Response(JSON.stringify(remoteSnapshot.sections), { status: 200 });
      bookmarkReads += 1;
      return new Response(
        JSON.stringify(
          bookmarkReads === 1
            ? cached
            : cached.map((item) => ({ ...item, title: item.id === "bm-a" ? "DB 첫" : "DB 둘" }))
        ),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    fireEvent.dragStart(screen.getByRole("link", { name: /캐시 첫/ }));
    const second = screen.getByRole("link", { name: /캐시 둘/ });
    fireEvent.dragOver(second);
    fireEvent.drop(second);

    expect(await screen.findByRole("alert")).toHaveTextContent("순서 저장 실패");
    expect(await screen.findByRole("link", { name: /DB 첫/ })).toBeInTheDocument();
    expect(bookmarkReads).toBe(2);
    expect(fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === "GET")).toHaveLength(6);
  });

  it("serializes overlapping reorder and preserves the later order after failure", async () => {
    const section = { id: "section-a", name: "기본", folderId: "work", position: 0 } satisfies Section;
    const bookmarks: BookmarkItem[] = [
      { id: "bm-a", title: "A", url: "https://a.example.com", description: null, isFavorite: false, folderId: "work", sectionId: section.id, position: 0 },
      { id: "bm-b", title: "B", url: "https://b.example.com", description: null, isFavorite: false, folderId: "work", sectionId: section.id, position: 1 },
      { id: "bm-c", title: "C", url: "https://c.example.com", description: null, isFavorite: false, folderId: "work", sectionId: section.id, position: 2 }
    ];
    stubBookmarkCache(bookmarks, [section]);
    let failFirst!: (response: Response) => void;
    const firstRequest = new Promise<Response>((resolve) => {
      failFirst = resolve;
    });
    let reorderCount = 0;
    const fetchMock = stubRemote(async () => {
      reorderCount += 1;
      return reorderCount === 1 ? firstRequest : new Response(null, { status: 204 });
    });
    render(<BookmarksPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    fireEvent.dragStart(screen.getByRole("link", { name: /^A https:\/\/a/ }));
    fireEvent.dragOver(screen.getByRole("link", { name: /^B https:\/\/b/ }));
    fireEvent.drop(screen.getByRole("link", { name: /^B https:\/\/b/ }));
    await waitFor(() => expect(mutationCalls(fetchMock)).toHaveLength(1));

    fireEvent.dragStart(screen.getByRole("link", { name: /^A https:\/\/a/ }));
    fireEvent.dragOver(screen.getByRole("link", { name: /^C https:\/\/c/ }));
    fireEvent.drop(screen.getByRole("link", { name: /^C https:\/\/c/ }));
    await act(async () => Promise.resolve());
    expect(mutationCalls(fetchMock)).toHaveLength(1);

    await act(async () => {
      failFirst(
        new Response(JSON.stringify({ detail: "첫 순서 저장 실패" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        })
      );
      await firstRequest;
    });

    await waitFor(() => expect(mutationCalls(fetchMock)).toHaveLength(2));
    const b = screen.getByRole("link", { name: /^B https:\/\/b/ });
    const c = screen.getByRole("link", { name: /^C https:\/\/c/ });
    const a = screen.getByRole("link", { name: /^A https:\/\/a/ });
    expect(b.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(c.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("creates a section separately and waits for the user to select it", async () => {
    stubBookmarkCache();
    const section = { id: "section-project", name: "프로젝트", folderId: "work", position: 0 } satisfies Section;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/sections");
      return new Response(JSON.stringify(section), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    });
    stubRemote(fetchMock);
    render(<BookmarksPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: "북마크 추가" }))[0]);
    expect(screen.queryByLabelText("새 섹션 이름")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "새 섹션 만들기" }));
    fireEvent.change(screen.getByLabelText("새 섹션 이름"), { target: { value: section.name } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("목록에서 선택하세요");
    const sectionSelect = screen.getByRole("combobox", { name: "섹션" });
    expect(sectionSelect).toHaveTextContent("없음");
    fireEvent.keyDown(sectionSelect, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: section.name }));
    expect(sectionSelect).toHaveTextContent(section.name);
  });

  it("does not create a duplicate section and points to the existing option", async () => {
    const section = { id: "section-basic", name: "기본", folderId: "work", position: 0 } satisfies Section;
    stubBookmarkCache([], [section]);
    const fetchMock = stubRemote(async () => {
      throw new Error("Unexpected mutation");
    });
    render(<BookmarksPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: "북마크 추가" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "새 섹션 만들기" }));
    fireEvent.change(screen.getByLabelText("새 섹션 이름"), { target: { value: " 기본 " } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    expect(mutationCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("이미 있습니다");
    const sectionSelect = screen.getByRole("combobox", { name: "섹션" });
    expect(sectionSelect).toHaveTextContent("없음");
    fireEvent.keyDown(sectionSelect, { key: "ArrowDown" });
    expect(await screen.findAllByRole("option", { name: section.name })).toHaveLength(1);
  });

  it("deletes a section without deleting its bookmarks", async () => {
    const section = { id: "section-basic", name: "기본", folderId: "work", position: 0 } satisfies Section;
    stubBookmarkCache(
      [{ id: "bm-1", title: "보존할 북마크", url: "https://example.com", description: null, isFavorite: false, folderId: "work", sectionId: section.id, position: 0 }],
      [section]
    );
    const fetchMock = stubRemote(async () => new Response(null, { status: 204 }));
    render(<BookmarksPage />);

    fireEvent.click(await screen.findByRole("button", { name: "기본 섹션 삭제" }));
    expect(screen.getByRole("dialog", { name: "섹션 삭제" })).toHaveTextContent("북마크는 삭제하지 않고 섹션 없음으로 이동합니다");
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(mutationCalls(fetchMock)).toHaveLength(1));
    expect(mutationCalls(fetchMock)[0]).toEqual([
      "/api/sections/section-basic",
      expect.objectContaining({ method: "DELETE" })
    ]);
    expect(screen.queryByRole("heading", { name: "기본" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "섹션 없음" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /보존할 북마크/ })).toBeInTheDocument();
  });

  it("edits a section in its folder", async () => {
    const section = { id: "section-basic", name: "기본", folderId: "work", position: 0 } satisfies Section;
    const updated = { ...section, name: "수정된 섹션" };
    stubBookmarkCache(
      [{ id: "bm-1", title: "북마크", url: "https://example.com", description: null, isFavorite: false, folderId: "work", sectionId: section.id, position: 0 }],
      [section]
    );
    const fetchMock = stubRemote(async (input, init) => {
      expect(String(input)).toBe(`/api/sections/${section.id}`);
      expect(init).toMatchObject({ method: "PATCH" });
      expect(JSON.parse(String(init?.body))).toEqual({ name: updated.name });
      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    render(<BookmarksPage />);

    fireEvent.click(await screen.findByRole("button", { name: "기본 섹션 편집" }));
    const dialog = screen.getByRole("dialog", { name: "섹션 편집" });
    fireEvent.change(within(dialog).getByLabelText("이름"), { target: { value: updated.name } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mutationCalls(fetchMock)).toHaveLength(1));
    expect(screen.getByRole("heading", { name: updated.name })).toBeInTheDocument();
  });

  it("offers deletion for an empty section in its folder", async () => {
    const section = { id: "section-empty", name: "빈 섹션", folderId: "work", position: 0 } satisfies Section;
    stubBookmarkCache([], [section]);
    render(<BookmarksPage />);

    expect(await screen.findByRole("heading", { name: section.name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "빈 섹션 섹션 삭제" }));

    expect(screen.getByRole("dialog", { name: "섹션 삭제" })).toBeInTheDocument();
  });

  it("shows a live saving status until the database request finishes", async () => {
    stubBookmarkCache();

    let finishRequest!: (response: Response) => void;
    const request = new Promise<Response>((resolve) => {
      finishRequest = resolve;
    });
    stubRemote(async () => request);

    render(<BookmarksPage />);
    const addButtons = await screen.findAllByRole("button", { name: "북마크 추가" });
    fireEvent.click(addButtons[0]);
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "https://example.com" } });
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "Example" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("status")).toHaveTextContent("데이터베이스에 저장 중");
    expect(screen.getByRole("button", { name: "저장 중..." })).toBeDisabled();

    await act(async () => {
      finishRequest(
        new Response(
          JSON.stringify({
            id: "bm-new",
            title: "Example",
            url: "https://example.com/",
            description: null,
            isFavorite: false,
            folderId: "work",
            sectionId: null,
            position: 0
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        )
      );
      await request;
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows a live deleting status until the database request finishes", async () => {
    stubBookmarkCache([
      {
        id: "bm-1",
        title: "Example",
        url: "https://example.com/",
        description: null,
        isFavorite: false,
        folderId: "work",
        sectionId: null,
        position: 0
      }
    ]);

    let finishRequest!: (response: Response) => void;
    const request = new Promise<Response>((resolve) => {
      finishRequest = resolve;
    });
    stubRemote(async () => request);

    render(<BookmarksPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Example 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(await screen.findByRole("status")).toHaveTextContent("데이터베이스에서 삭제 중");
    expect(screen.getByRole("button", { name: "삭제 중..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "닫기" })).toBeDisabled();

    await act(async () => {
      finishRequest(new Response(null, { status: 204 }));
      await request;
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
