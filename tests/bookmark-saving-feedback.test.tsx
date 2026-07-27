import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BookmarksPage from "@/app/(dashboard)/bookmarks/page";
import type { BookmarkItem, Section } from "@/app/lib/bookmarks/types";

function stubBookmarkCache(bookmarks: BookmarkItem[] = [], sections: Section[] = []) {
  const cache = JSON.stringify({
    version: 1,
    apiBacked: true,
    savedAt: Date.now(),
    folders: [{ id: "work", name: "작업", color: "#4f46e5", position: 0 }],
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
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    const first = await screen.findByRole("link", { name: /첫 북마크/ });
    const second = screen.getByRole("link", { name: /둘째 북마크/ });
    fireEvent.dragStart(first);
    fireEvent.dragOver(second);
    fireEvent.drop(second);

    expect(fetchMock).not.toHaveBeenCalled();
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
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    fireEvent.dragStart(await screen.findByRole("link", { name: /첫 북마크/ }));
    const second = screen.getByRole("link", { name: /둘째 북마크/ });
    fireEvent.dragOver(second);
    fireEvent.drop(second);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/bookmarks/reorder");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual([
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: "순서 저장에 실패했습니다." }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        })
      )
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: "즐겨찾기 저장에 실패했습니다." }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        })
      )
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
    vi.stubGlobal("fetch", fetchMock);
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
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: "북마크 추가" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "새 섹션 만들기" }));
    fireEvent.change(screen.getByLabelText("새 섹션 이름"), { target: { value: " 기본 " } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    expect(fetchMock).not.toHaveBeenCalled();
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
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    fireEvent.click(await screen.findByRole("button", { name: "기본 섹션 삭제" }));
    expect(screen.getByRole("dialog", { name: "섹션 삭제" })).toHaveTextContent("북마크는 삭제하지 않고 섹션 없음으로 이동합니다");
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/sections/section-basic", expect.objectContaining({ method: "DELETE" }));
    expect(screen.queryByRole("heading", { name: "기본" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "섹션 없음" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /보존할 북마크/ })).toBeInTheDocument();
  });

  it("offers deletion for a selected empty section", async () => {
    const section = { id: "section-empty", name: "빈 섹션", folderId: "work", position: 0 } satisfies Section;
    stubBookmarkCache([], [section]);
    render(<BookmarksPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: "북마크 추가" }))[0]);
    const sectionSelect = screen.getByRole("combobox", { name: "섹션" });
    fireEvent.keyDown(sectionSelect, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: section.name }));
    fireEvent.click(screen.getByRole("button", { name: "선택한 섹션 삭제" }));

    expect(screen.getByRole("dialog", { name: "섹션 삭제" })).toBeInTheDocument();
  });

  it("shows a live saving status until the database request finishes", async () => {
    stubBookmarkCache();

    let finishRequest!: (response: Response) => void;
    const request = new Promise<Response>((resolve) => {
      finishRequest = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => request));

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
    vi.stubGlobal("fetch", vi.fn(() => request));

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
