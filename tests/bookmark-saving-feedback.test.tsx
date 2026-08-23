import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BookmarksPage from "@/app/(dashboard)/page";
import type { BookmarkItem, Folder, FolderSection, Section } from "@/app/lib/bookmarks/types";

const sections: Section[] = [
  { id: "work", name: "업무", color: "#4f46e5", position: 0 },
  { id: "knowledge", name: "지식", color: "#2166d7", position: 1 }
];
const folders: Folder[] = [
  { id: "projects", name: "프로젝트", color: "#4f46e5", sectionId: "work", position: 0 },
  { id: "operations", name: "운영", color: "#d97706", sectionId: "work", position: 1 },
  { id: "docs", name: "문서", color: "#2166d7", sectionId: "knowledge", position: 0 },
  { id: "loose", name: "미분류", color: "#797979", sectionId: null, position: 0 }
];
const bookmarks: BookmarkItem[] = [
  { id: "p1", title: "프로젝트 A", url: "https://p1.example.com", description: null, isFavorite: false, folderId: "projects", position: 0 },
  { id: "p2", title: "프로젝트 B", url: "https://p2.example.com", description: null, isFavorite: false, folderId: "projects", position: 1 },
  { id: "o1", title: "운영 A", url: "https://o1.example.com", description: null, isFavorite: false, folderId: "operations", position: 0 },
  { id: "d1", title: "문서 A", url: "https://d1.example.com", description: null, isFavorite: false, folderId: "docs", position: 0 }
];

let snapshot: {
  folders: Folder[];
  sections: Section[];
  bookmarks: BookmarkItem[];
  folderSections: FolderSection[];
} = { folders, sections, bookmarks, folderSections: [] };

function installCache(
  data: {
    folders: Folder[];
    sections: Section[];
    bookmarks: BookmarkItem[];
    folderSections?: FolderSection[];
  },
  selection: { kind: "folder" | "section"; id: string } = { kind: "section", id: "work" }
) {
  const cache = JSON.stringify({
    version: 4,
    apiBacked: true,
    savedAt: Date.now(),
    folderSections: [],
    ...data,
    selection
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

function applyMutationToSnapshot(path: string, method: string, bodyText: string | undefined) {
  if (!bodyText) return;
  if (method === "POST" && path === "/api/bookmarks") {
    const body = JSON.parse(bodyText) as Omit<BookmarkItem, "id" | "position">;
    snapshot = {
      ...snapshot,
      bookmarks: [
        ...snapshot.bookmarks,
        {
          id: `created-${snapshot.bookmarks.length}`,
          position: snapshot.bookmarks.filter((item) => (
            item.folderId === body.folderId
            && (item.folderSectionId ?? null) === (body.folderSectionId ?? null)
          )).length,
          ...body
        }
      ]
    };
    return;
  }
  if (method === "POST" && path.endsWith("/reorder")) {
    const body = JSON.parse(bodyText) as Array<{ id: string; position: number }>;
    const collection = path.includes("/folder-sections/")
      ? "folderSections"
      : path.includes("/folders/")
        ? "folders"
        : path.includes("/sections/")
          ? "sections"
          : "bookmarks";
    snapshot = {
      ...snapshot,
      [collection]: snapshot[collection].map((item) => {
        const next = body.find((entry) => entry.id === item.id);
        return next ? { ...item, position: next.position } : item;
      })
    };
    return;
  }
  if (method !== "PATCH") return;
  const patch = JSON.parse(bodyText) as Record<string, unknown>;
  if (path.startsWith("/api/folders/")) {
    const id = path.slice("/api/folders/".length);
    snapshot = {
      ...snapshot,
      folders: snapshot.folders.map((folder) => folder.id === id ? { ...folder, ...patch } : folder)
    };
  }
  if (path.startsWith("/api/bookmarks/")) {
    const id = path.slice("/api/bookmarks/".length);
    snapshot = {
      ...snapshot,
      bookmarks: snapshot.bookmarks.map((item) => item.id === id ? { ...item, ...patch } : item)
    };
  }
}

function setup(
  data: {
    folders: Folder[];
    sections: Section[];
    bookmarks: BookmarkItem[];
    folderSections?: FolderSection[];
  } = snapshot,
  mutation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> =
    async () => new Response(null, { status: 204 })
) {
  snapshot = { ...data, folderSections: data.folderSections ?? [] };
  const { setItem } = installCache(data);
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (method === "GET") {
      if (path === "/api/folders") return new Response(JSON.stringify(snapshot.folders), { status: 200 });
      if (path === "/api/sections") return new Response(JSON.stringify(snapshot.sections), { status: 200 });
      if (path === "/api/folder-sections") return new Response(JSON.stringify(snapshot.folderSections), { status: 200 });
      if (path === "/api/bookmarks") return new Response(JSON.stringify(snapshot.bookmarks), { status: 200 });
    }
    const response = await mutation(input, init);
    if (response.ok) applyMutationToSnapshot(path, method, init?.body ? String(init.body) : undefined);
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<BookmarksPage />);
  return { fetchMock, setItem };
}

const mutations = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");

async function openMenu(label: string, scope: HTMLElement = document.body) {
  const trigger = await within(scope).findByRole("button", { name: `${label} 메뉴` });
  fireEvent.keyDown(trigger, { key: "Enter" });
  return screen.findByRole("menu", { name: `${label} 메뉴` });
}

function folderNamesInSection(sectionName: string) {
  const list = screen.getByRole("list", { name: `${sectionName} 폴더` });
  return within(list)
    .getAllByRole("listitem")
    .map((item) => (within(item).getByRole("button", { name: /메뉴$/ }).getAttribute("aria-label") ?? "").replace(/ 메뉴$/, ""));
}

function mockRect(top: number, height: number) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 200,
    width: 200,
    x: 0,
    y: top,
    toJSON: () => ({})
  });
}

function firePointerDrag(el: HTMLElement, type: "dragover" | "drop", clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientY", { value: clientY });
  fireEvent(el, event);
}

function dropFolderOn(sourceName: string, targetName: string, nav: HTMLElement) {
  fireEvent.dragStart(within(nav).getByRole("button", { name: `${sourceName} 0` }));
  fireEvent.dragOver(within(nav).getByRole("button", { name: `${targetName} 0` }));
  fireEvent.drop(within(nav).getByRole("button", { name: `${targetName} 0` }));
}

describe("section-first bookmark UI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    snapshot = { folders, sections, bookmarks, folderSections: [] };
  });

  it("shows a selected section as folder-based bookmark groups", async () => {
    setup();
    expect(await screen.findByRole("heading", { name: "프로젝트" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "운영" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /프로젝트 A/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /운영 A/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "문서" })).not.toBeInTheDocument();
  });

  it("shows only the clicked folder", async () => {
    setup();
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    fireEvent.click(within(nav).getByRole("button", { name: "운영 1" }));
    expect((await screen.findAllByRole("heading", { name: "섹션 없음" })).some((heading) => heading.tagName === "H2")).toBe(true);
    expect((await screen.findAllByRole("heading", { name: "운영" })).some((heading) => heading.tagName === "H1")).toBe(true);
    expect(screen.getByRole("link", { name: /운영 A/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /프로젝트 A/ })).not.toBeInTheDocument();
  });

  it("renders unassigned folders in the final 섹션 없음 area", async () => {
    setup();
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    const areas = within(nav).getAllByRole("region");
    expect(areas.at(-1)).toHaveAccessibleName("섹션 없음");
    expect(within(areas.at(-1)!).getByText("미분류")).toBeInTheDocument();
    expect(within(nav).queryByRole("tree")).not.toBeInTheDocument();
  });

  it("moves a folder when dropped on a section header", async () => {
    const moved = { ...folders[3], sectionId: "work", position: 2 };
    const { fetchMock } = setup(snapshot, async (input, init) => {
      expect(String(input)).toBe("/api/folders/loose");
      expect(JSON.parse(String(init?.body))).toEqual({ sectionId: "work" });
      return new Response(JSON.stringify(moved), { status: 200 });
    });
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    fireEvent.dragStart(within(nav).getByRole("button", { name: "미분류 0" }));
    fireEvent.dragOver(within(nav).getByRole("button", { name: "업무" }));
    fireEvent.drop(within(nav).getByRole("button", { name: "업무" }));
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(within(within(nav).getByRole("region", { name: "업무" })).getByText("미분류")).toBeInTheDocument();
  });

  it("reorders sections and rolls back on failure", async () => {
    const { setItem } = setup(snapshot, async () =>
      new Response(JSON.stringify({ detail: "섹션 순서 저장에 실패했습니다." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    );
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    const work = within(nav).getByRole("button", { name: "업무" });
    const knowledge = within(nav).getByRole("button", { name: "지식" });
    fireEvent.dragStart(work);
    fireEvent.dragOver(knowledge);
    fireEvent.drop(knowledge);
    expect(await screen.findByRole("alert")).toHaveTextContent("섹션 순서 저장에 실패했습니다.");
    expect(work.compareDocumentPosition(knowledge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.sections).toMatchObject([
        { id: "work", position: 0 },
        { id: "knowledge", position: 1 }
      ]);
    });
  });

  it("keeps folders under 섹션 없음 after deleting their section", async () => {
    setup();
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    const menu = await openMenu("업무", nav);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(within(nav).queryByRole("region", { name: "업무" })).not.toBeInTheDocument());
    const unassigned = within(nav).getByRole("region", { name: "섹션 없음" });
    expect(within(unassigned).getByText("프로젝트")).toBeInTheDocument();
    expect(within(unassigned).getByText("운영")).toBeInTheDocument();
  });

  it("deletes a folder and moves its bookmarks to another folder", async () => {
    const { fetchMock } = setup();
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    const menu = await openMenu("프로젝트", nav);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(String(mutations(fetchMock)[0][0])).toContain("destination_folder_id=");
    expect(within(nav).queryByText("프로젝트")).not.toBeInTheDocument();
  });

  it("reorders bookmarks only within the same folder", async () => {
    const { fetchMock } = setup();
    const first = await screen.findByRole("link", { name: /프로젝트 A/ });
    const second = screen.getByRole("link", { name: /프로젝트 B/ });
    fireEvent.dragStart(first);
    fireEvent.dragOver(second);
    fireEvent.drop(second);
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(mutations(fetchMock)[0][0]).toBe("/api/bookmarks/reorder");

    fireEvent.dragStart(screen.getByRole("link", { name: /프로젝트 A/ }));
    const otherFolder = screen.getByRole("link", { name: /운영 A/ });
    fireEvent.dragOver(otherFolder);
    fireEvent.drop(otherFolder);
    expect(mutations(fetchMock)).toHaveLength(1);
  });

  it("moves a bookmark to another section only when dropped on that section header", async () => {
    const folderSections: FolderSection[] = [
      { id: "daily", name: "매일", color: "#4f46e5", folderId: "projects", position: 0 },
      { id: "weekly", name: "주간", color: "#16a34a", folderId: "projects", position: 1 }
    ];
    const scoped: BookmarkItem[] = [
      { ...bookmarks[0], folderSectionId: "daily", position: 0 },
      { ...bookmarks[1], folderSectionId: "weekly", position: 0 }
    ];
    const { fetchMock } = setup({ folders, sections, bookmarks: scoped, folderSections });
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    fireEvent.click(within(nav).getByRole("button", { name: "프로젝트 2" }));
    const source = await screen.findByRole("link", { name: /프로젝트 A/ });
    const otherCard = screen.getByRole("link", { name: /프로젝트 B/ });
    fireEvent.dragStart(source);
    fireEvent.dragOver(otherCard);
    fireEvent.drop(otherCard);
    expect(mutations(fetchMock)).toHaveLength(0);

    fireEvent.dragStart(screen.getByRole("link", { name: /프로젝트 A/ }));
    fireEvent.drop(screen.getByRole("heading", { name: "주간" }));
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(mutations(fetchMock)[0][0]).toBe("/api/bookmarks/p1");
    expect(JSON.parse(String(mutations(fetchMock)[0][1]?.body))).toEqual({ folderSectionId: "weekly" });
  });

  it("reorders sidebar sections by drop position instead of swapping onto the target", async () => {
    const extra: Section = { id: "life", name: "생활", color: "#16a34a", position: 2 };
    const { fetchMock } = setup({ folders, sections: [...sections, extra], bookmarks: [] });
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    const work = within(nav).getByRole("button", { name: "업무" });
    const life = within(nav).getByRole("button", { name: "생활" });
    const target = life.closest("[draggable]") as HTMLElement;
    mockRect(100, 40);
    fireEvent.dragStart(work);
    firePointerDrag(target, "dragover", 110);
    firePointerDrag(target, "drop", 110);
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(mutations(fetchMock)[0][0]).toBe("/api/sections/reorder");
    expect(JSON.parse(String(mutations(fetchMock)[0][1]?.body))).toEqual([
      { id: "knowledge", position: 0 },
      { id: "work", position: 1 },
      { id: "life", position: 2 }
    ]);
  });

  it("does not highlight a folder in another section as a drop target", async () => {
    setup();
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    fireEvent.dragStart(within(nav).getByRole("button", { name: "미분류 0" }));
    fireEvent.dragOver(within(nav).getByRole("button", { name: "프로젝트 2" }));
    expect(within(nav).getByRole("button", { name: "프로젝트 2" }).closest("li")).not.toHaveClass("ring-2");
  });

  it("does not highlight a folder while a sidebar section is being dragged", async () => {
    setup();
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    fireEvent.dragStart(within(nav).getByRole("button", { name: "업무" }));
    fireEvent.dragOver(within(nav).getByRole("button", { name: "문서 1" }));
    expect(within(nav).getByRole("button", { name: "문서 1" }).closest("li")).not.toHaveClass("ring-2");
  });

  it("dims a sidebar section together with its folders while it is dragged", async () => {
    setup();
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    fireEvent.dragStart(within(nav).getByRole("button", { name: "업무" }));
    const region = within(nav).getByRole("region", { name: "업무" });
    expect(region).toHaveClass("opacity-60");
    expect(within(region).getByText("프로젝트")).toBeInTheDocument();
  });

  it("reorders sidebar sections when dropped onto another section's folders", async () => {
    const extra: Section = { id: "life", name: "생활", color: "#16a34a", position: 2 };
    const { fetchMock } = setup({ folders, sections: [...sections, extra], bookmarks: [] });
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    fireEvent.dragStart(within(nav).getByRole("button", { name: "업무" }));
    const knowledge = within(nav).getByRole("region", { name: "지식" });
    mockRect(100, 80);
    firePointerDrag(knowledge, "dragover", 150);
    firePointerDrag(knowledge, "drop", 150);
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(mutations(fetchMock)[0][0]).toBe("/api/sections/reorder");
    expect(JSON.parse(String(mutations(fetchMock)[0][1]?.body))).toEqual([
      { id: "knowledge", position: 0 },
      { id: "work", position: 1 },
      { id: "life", position: 2 }
    ]);
  });

  it("reorders folder sections when a section header is dropped after another", async () => {
    const folderSections: FolderSection[] = [
      { id: "daily", name: "매일", color: "#4f46e5", folderId: "projects", position: 0 },
      { id: "weekly", name: "주간", color: "#16a34a", folderId: "projects", position: 1 }
    ];
    const { fetchMock } = setup({
      folders,
      sections,
      bookmarks: [{ ...bookmarks[0], folderSectionId: "daily" }],
      folderSections
    });
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    fireEvent.click(within(nav).getByRole("button", { name: "프로젝트 1" }));
    expect(screen.getByRole("heading", { name: "매일" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "주간" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "섹션 없음" })).not.toBeInTheDocument();
    const daily = await screen.findByRole("heading", { name: "매일" });
    const weekly = screen.getByRole("heading", { name: "주간" });
    const dailyHeader = daily.parentElement as HTMLElement;
    const weeklyHeader = weekly.parentElement as HTMLElement;
    mockRect(100, 40);
    fireEvent.dragStart(dailyHeader);
    firePointerDrag(weeklyHeader, "dragover", 130);
    firePointerDrag(weeklyHeader, "drop", 130);
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(mutations(fetchMock)[0][0]).toBe("/api/folder-sections/reorder");
    expect(JSON.parse(String(mutations(fetchMock)[0][1]?.body))).toEqual([
      { id: "weekly", position: 0 },
      { id: "daily", position: 1 }
    ]);
  });

  it("removes section selection from the bookmark modal", async () => {
    setup();
    fireEvent.click((await screen.findAllByRole("button", { name: "북마크 추가" }))[0]);
    const dialog = screen.getByRole("dialog", { name: "북마크 추가" });
    expect(within(dialog).getByRole("combobox", { name: "폴더" })).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "섹션" })).toHaveTextContent("섹션 없음");
    expect(within(dialog).queryByText("새 섹션 만들기")).not.toBeInTheDocument();
  });

  it("uses folder group actions in the main content", async () => {
    setup();
    const trigger = await screen.findByRole("button", { name: "프로젝트 폴더 그룹 메뉴" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const menu = screen.getByRole("menu", { name: "프로젝트 폴더 그룹 메뉴" });
    expect(within(menu).getByRole("menuitem", { name: "북마크 추가" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "편집" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "삭제" })).toBeInTheDocument();
  });

  it("uses the fixed four-column grid without a list view selector", async () => {
    setup();
    const card = await screen.findByRole("link", { name: /프로젝트 A/ });
    expect(screen.queryByRole("button", { name: "리스트" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "그리드" })).not.toBeInTheDocument();
    expect(card.parentElement).toHaveClass("lg:grid-cols-2", "xl:grid-cols-4");
    expect(card).toHaveAttribute("draggable", "true");
    expect(screen.queryByTitle("드래그해서 위치 변경")).not.toBeInTheDocument();
  });

  it("reflects a folder color, hides card tags, and creates a bookmark from its group menu", async () => {
    const created: BookmarkItem = {
      id: "created",
      title: "그룹에서 추가",
      url: "https://created.example.com/",
      description: null,
      isFavorite: false,
      folderId: "projects",
      position: 2
    };
    const { fetchMock } = setup(snapshot, async (input, init) => {
      expect(String(input)).toBe("/api/bookmarks");
      expect(init).toMatchObject({ method: "POST" });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        folderId: "projects",
        title: created.title
      });
      return new Response(JSON.stringify(created), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    });

    const heading = await screen.findByRole("heading", { name: "프로젝트" });
    expect(heading.parentElement?.querySelector("[data-folder-color]")).toHaveAttribute(
      "data-folder-color",
      "#4f46e5"
    );
    const card = screen.getByRole("link", { name: /프로젝트 A/ });
    expect(within(card).queryByText("프로젝트")).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "프로젝트 폴더 그룹 메뉴" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("menu", { name: "프로젝트 폴더 그룹 메뉴" })).getByRole("menuitem", { name: "북마크 추가" }));
    const dialog = screen.getByRole("dialog", { name: "북마크 추가" });
    expect(within(dialog).getByRole("combobox", { name: "폴더" })).toHaveTextContent("프로젝트");
    fireEvent.change(within(dialog).getByLabelText("URL"), { target: { value: created.url } });
    fireEvent.change(within(dialog).getByLabelText("제목"), { target: { value: created.title } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
  });

  it("keeps card drag sorting while moving card actions into an ellipsis menu", async () => {
    setup();
    const card = await screen.findByRole("link", { name: /프로젝트 A/ });
    expect(card).toHaveAttribute("draggable", "true");
    expect(within(card).queryByTitle("드래그해서 위치 변경")).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "프로젝트 A 편집" })).not.toBeInTheDocument();
    const trigger = within(card).getByRole("button", { name: "프로젝트 A 메뉴" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const menu = screen.getByRole("menu", { name: "프로젝트 A 메뉴" });
    expect(within(menu).getByRole("menuitem", { name: "편집" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "복제" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "삭제" })).toBeInTheDocument();
  });

  it("duplicates a bookmark into the same folder and section with copy in the title", async () => {
    const source: BookmarkItem = {
      id: "p1",
      title: "프로젝트 A",
      url: "https://p1.example.com",
      description: "설명",
      isFavorite: true,
      folderId: "projects",
      folderSectionId: "fs1",
      position: 0
    };
    const created: BookmarkItem = {
      ...source,
      id: "p1-copy",
      title: "프로젝트 A copy",
      position: 1
    };
    const data = {
      folders,
      sections,
      folderSections: [{ id: "fs1", name: "진행중", folderId: "projects", position: 0, color: null }],
      bookmarks: [source]
    };
    const { fetchMock } = setup(data, async (input, init) => {
      expect(String(input)).toBe("/api/bookmarks");
      expect(init).toMatchObject({ method: "POST" });
      expect(JSON.parse(String(init?.body))).toEqual({
        title: "프로젝트 A copy",
        url: "https://p1.example.com",
        description: "설명",
        folderId: "projects",
        folderSectionId: "fs1",
        isFavorite: true
      });
      return new Response(JSON.stringify(created), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    });

    const menu = await openMenu("프로젝트 A");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "복제" }));
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(await screen.findByRole("link", { name: /프로젝트 A copy/ })).toBeInTheDocument();
  });

  it("groups sidebar folder actions in an ellipsis menu", async () => {
    setup();
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    const menu = await openMenu("프로젝트", nav);
    expect(within(menu).queryByRole("menuitem", { name: "하위 폴더 추가" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "편집" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "삭제" })).toBeInTheDocument();
  });

  it("portals the modal overlay to the viewport layer", async () => {
    setup();
    fireEvent.click((await screen.findAllByRole("button", { name: "북마크 추가" }))[0]);
    expect(screen.getByRole("dialog").parentElement).toBe(document.body);
  });

  it("paints cache immediately and replaces it with a successful remote refresh", async () => {
    const cached: BookmarkItem = {
      id: "cached",
      title: "Cached",
      url: "https://cached.example.com",
      description: null,
      isFavorite: false,
      folderId: "projects",
      position: 0
    };
    const remote: BookmarkItem = { ...cached, id: "remote", title: "Remote" };
    const data = { folders, sections, bookmarks: [cached] };
    snapshot = { ...data, folderSections: [] };
    const { setItem } = installCache(data);
    let resolveFolders!: (response: Response) => void;
    let resolveSections!: (response: Response) => void;
    let resolveFolderSections!: (response: Response) => void;
    let resolveBookmarks!: (response: Response) => void;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/folders") {
        return new Promise<Response>((resolve) => { resolveFolders = resolve; });
      }
      if (String(input) === "/api/sections") {
        return new Promise<Response>((resolve) => { resolveSections = resolve; });
      }
      if (String(input) === "/api/folder-sections") {
        return new Promise<Response>((resolve) => { resolveFolderSections = resolve; });
      }
      return new Promise<Response>((resolve) => { resolveBookmarks = resolve; });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    expect(await screen.findByRole("link", { name: /Cached/ })).toBeInTheDocument();
    await act(async () => {
      resolveFolders(new Response(JSON.stringify(folders), { status: 200 }));
      resolveSections(new Response(JSON.stringify(sections), { status: 200 }));
      resolveFolderSections(new Response(JSON.stringify([]), { status: 200 }));
      resolveBookmarks(new Response(JSON.stringify([remote]), { status: 200 }));
    });
    expect(await screen.findByRole("link", { name: /Remote/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Cached/ })).not.toBeInTheDocument();
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved).toMatchObject({ apiBacked: true, bookmarks: [{ id: "remote", title: "Remote" }] });
    });
  });

  it("keeps cache on remote failure and does not trust cached apiBacked", async () => {
    const cached = { ...bookmarks[0], id: "cached", title: "Cached" };
    const data = { folders, sections, bookmarks: [cached] };
    const { setItem } = installCache(data);
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    expect(await screen.findByRole("link", { name: /Cached/ })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved).toMatchObject({ apiBacked: false, bookmarks: [{ id: "cached" }] });
    });
    fireEvent.click(screen.getByRole("button", { name: "Cached 즐겨찾기" }));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(screen.getByRole("button", { name: "Cached 즐겨찾기" }).querySelector("svg")).toHaveClass("fill-[var(--color-brand)]");
  });

  it("opens folder choices above the bookmark modal and lets Escape close the choices first", async () => {
    setup();
    fireEvent.click((await screen.findAllByRole("button", { name: "북마크 추가" }))[0]);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "폴더" }), { key: "ArrowDown" });
    const listbox = await screen.findByRole("listbox");
    expect(listbox).toHaveClass("z-[110]");
    fireEvent.keyDown(listbox, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "북마크 추가" })).toBeInTheDocument();
  });

  it("keeps mutation buttons enabled while refreshing cached data", async () => {
    const bookmark = { ...bookmarks[0], id: "cached-refresh", title: "Cached Refresh" };
    const data = { folders, sections, bookmarks: [bookmark] };
    installCache(data);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        return new Promise<Response>(() => {});
      }
      return Promise.resolve(new Response(JSON.stringify({ ...bookmark, isFavorite: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    const card = await screen.findByRole("link", { name: /Cached Refresh/ });
    const favorite = screen.getByRole("button", { name: "Cached Refresh 즐겨찾기" });
    expect(card).toHaveAttribute("draggable", "true");
    expect(favorite).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cached Refresh 메뉴" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "업무 메뉴" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "프로젝트 메뉴" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "새 폴더" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "새 섹션" })).toBeEnabled();
    screen.getAllByRole("button", { name: "북마크 추가" }).forEach((button) => expect(button).toBeEnabled());
    fireEvent.click(favorite);
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(favorite.querySelector("svg")).toHaveClass("fill-[var(--color-brand)]");
  });

  it("does not show mutation buttons before the first hydrate", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    });
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<BookmarksPage />);

    expect(screen.queryByRole("button", { name: "북마크 추가" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "새 폴더" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "새 섹션" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "북마크 폴더" })).not.toBeInTheDocument();
  });

  it("shows a folder move before the server responds, even during refresh", async () => {
    installCache({ folders, sections, bookmarks });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") return new Promise<Response>(() => {});
      return new Promise<Response>(() => {});
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    fireEvent.dragStart(within(nav).getByRole("button", { name: "미분류 0" }));
    fireEvent.dragOver(within(nav).getByRole("button", { name: "업무" }));
    fireEvent.drop(within(nav).getByRole("button", { name: "업무" }));
    expect(within(within(nav).getByRole("region", { name: "업무" })).getByText("미분류")).toBeInTheDocument();
  });

  it("does not let a background refresh overwrite an in-flight folder move", async () => {
    installCache({ folders, sections, bookmarks });
    snapshot = { folders, sections, bookmarks, folderSections: [] };
    let folderGets = 0;
    let releaseRefresh!: (response: Response) => void;
    const refreshFolders = new Promise<Response>((resolve) => { releaseRefresh = resolve; });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? "GET";
      if (method === "PATCH") return new Promise<Response>(() => {});
      if (method === "GET" && path === "/api/folders") {
        folderGets += 1;
        if (folderGets === 1) return Promise.resolve(new Response(JSON.stringify(folders), { status: 200 }));
        return refreshFolders;
      }
      if (method === "GET" && path === "/api/sections") {
        return Promise.resolve(new Response(JSON.stringify(sections), { status: 200 }));
      }
      if (method === "GET" && path === "/api/folder-sections") {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      if (method === "GET" && path === "/api/bookmarks") {
        return Promise.resolve(new Response(JSON.stringify(bookmarks), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    await waitFor(() => expect(folderGets).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "북마크 새로고침" }));
    await waitFor(() => expect(folderGets).toBe(2));
    fireEvent.dragStart(within(nav).getByRole("button", { name: "미분류 0" }));
    fireEvent.dragOver(within(nav).getByRole("button", { name: "업무" }));
    fireEvent.drop(within(nav).getByRole("button", { name: "업무" }));
    expect(within(within(nav).getByRole("region", { name: "업무" })).getByText("미분류")).toBeInTheDocument();
    await act(async () => {
      releaseRefresh(new Response(JSON.stringify(folders), { status: 200 }));
    });
    expect(within(within(nav).getByRole("region", { name: "업무" })).getByText("미분류")).toBeInTheDocument();
  });

  it("keeps the latest folder order when earlier reorder responses arrive late", async () => {
    const workFolders: Folder[] = [
      { id: "a", name: "폴더A", color: "#4f46e5", sectionId: "work", position: 0 },
      { id: "b", name: "폴더B", color: "#d97706", sectionId: "work", position: 1 },
      { id: "c", name: "폴더C", color: "#2166d7", sectionId: "work", position: 2 },
      { id: "d", name: "폴더D", color: "#797979", sectionId: "work", position: 3 }
    ];
    const data = { folders: workFolders, sections: [sections[0]], bookmarks: [] };
    const finalOrder = ["폴더B", "폴더C", "폴더D", "폴더A"];
    const held: Array<(response: Response) => void> = [];
    setup(data, async (input, init) => {
      if (String(input) !== "/api/folders/reorder") return new Response(null, { status: 204 });
      return new Promise<Response>((resolve) => {
        held.push(resolve);
      });
    });

    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    dropFolderOn("폴더A", "폴더B", nav);
    expect(folderNamesInSection("업무")).toEqual(["폴더B", "폴더A", "폴더C", "폴더D"]);
    dropFolderOn("폴더A", "폴더C", nav);
    expect(folderNamesInSection("업무")).toEqual(["폴더B", "폴더C", "폴더A", "폴더D"]);
    dropFolderOn("폴더A", "폴더D", nav);
    expect(folderNamesInSection("업무")).toEqual(finalOrder);

    await waitFor(() => expect(held).toHaveLength(1));

    const release = async (index: number) => {
      const resolve = held[index];
      if (!resolve) throw new Error(`reorder ${index} is not in flight`);
      await act(async () => {
        resolve(new Response(null, { status: 204 }));
      });
    };

    await release(0);
    expect(folderNamesInSection("업무")).toEqual(finalOrder);
    await waitFor(() => expect(held).toHaveLength(2));
    await release(1);
    expect(folderNamesInSection("업무")).toEqual(finalOrder);
    await waitFor(() => expect(held).toHaveLength(3));
    await release(2);
    expect(folderNamesInSection("업무")).toEqual(finalOrder);
    expect(screen.getByRole("button", { name: "새 폴더" })).toBeEnabled();
  });

  it("shows a created bookmark before the server responds", async () => {
    const request = new Promise<Response>(() => {});
    setup(snapshot, async () => request);
    fireEvent.click((await screen.findAllByRole("button", { name: "북마크 추가" }))[0]);
    const dialog = screen.getByRole("dialog", { name: "북마크 추가" });
    fireEvent.change(within(dialog).getByLabelText("URL"), { target: { value: "https://example.com" } });
    fireEvent.change(within(dialog).getByLabelText("제목"), { target: { value: "Example" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("link", { name: /Example/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("데이터베이스에 저장 중");
  });

  it("removes a bookmark before the server responds", async () => {
    setup(snapshot, async () => new Promise<Response>(() => {}));
    const trigger = await screen.findByRole("button", { name: "프로젝트 A 메뉴" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "삭제" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "북마크 삭제" })).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: /프로젝트 A/ })).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("데이터베이스에서 삭제 중");
  });

  it("keeps cached mutations local after the initial remote bootstrap fails", async () => {
    const bookmark = { ...bookmarks[0], id: "fallback", title: "Fallback" };
    const data = { folders, sections, bookmarks: [bookmark] };
    const { setItem } = installCache(data);
    const resolvers: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        return new Promise<Response>((resolve) => { resolvers.push(resolve); });
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);

    const favorite = await screen.findByRole("button", { name: "Fallback 즐겨찾기" });
    expect(favorite).toBeEnabled();
    await act(async () => {
      resolvers.forEach((resolve) =>
        resolve(new Response(JSON.stringify({ detail: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        }))
      );
    });
    fireEvent.click(favorite);
    expect(mutations(fetchMock)).toHaveLength(0);
    expect(favorite.querySelector("svg")).toHaveClass("fill-[var(--color-brand)]");
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.bookmarks[0]).toMatchObject({ id: "fallback", isFavorite: true });
    });
  });

  it("rolls back bookmark order and cache when reorder saving fails", async () => {
    const scoped = bookmarks.slice(0, 2);
    const { setItem } = setup(
      { folders, sections, bookmarks: scoped },
      async () => new Response(JSON.stringify({ detail: "순서 저장에 실패했습니다." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    );
    const first = await screen.findByRole("link", { name: /프로젝트 A/ });
    const second = screen.getByRole("link", { name: /프로젝트 B/ });
    fireEvent.dragStart(first);
    fireEvent.dragOver(second);
    fireEvent.drop(second);
    expect(await screen.findByRole("alert")).toHaveTextContent("순서 저장에 실패했습니다.");
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.bookmarks).toMatchObject([
        { id: "p1", position: 0 },
        { id: "p2", position: 1 }
      ]);
    });
  });

  it("rolls back folder order and cache when reorder saving fails", async () => {
    const scopedFolders = folders.slice(0, 2);
    const { setItem } = setup(
      { folders: scopedFolders, sections: [sections[0]], bookmarks: [] },
      async () => new Response(JSON.stringify({ detail: "폴더 순서 저장에 실패했습니다." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    );
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    const first = within(nav).getByRole("button", { name: "프로젝트 0" });
    const second = within(nav).getByRole("button", { name: "운영 0" });
    fireEvent.dragStart(first);
    fireEvent.dragOver(second);
    fireEvent.drop(second);
    expect(await screen.findByRole("alert")).toHaveTextContent("폴더 순서 저장에 실패했습니다.");
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.folders).toMatchObject([
        { id: "projects", position: 0 },
        { id: "operations", position: 1 }
      ]);
    });
  });

  it("rolls back favorite state and cache when saving fails", async () => {
    const bookmark = { ...bookmarks[0], id: "favorite-fail", title: "Favorite Fail" };
    const { setItem } = setup(
      { folders, sections, bookmarks: [bookmark] },
      async () => new Response(JSON.stringify({ detail: "즐겨찾기 저장에 실패했습니다." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    );
    const favorite = await screen.findByRole("button", { name: "Favorite Fail 즐겨찾기" });
    fireEvent.click(favorite);
    expect(await screen.findByRole("alert")).toHaveTextContent("즐겨찾기 저장에 실패했습니다.");
    expect(favorite.querySelector("svg")).not.toHaveClass("fill-[var(--color-brand)]");
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.bookmarks[0]).toMatchObject({ id: "favorite-fail", isFavorite: false });
    });
  });

  it("preserves a later successful favorite change when an earlier request fails", async () => {
    const first = { ...bookmarks[0], id: "first", title: "First" };
    const second = { ...bookmarks[1], id: "second", title: "Second" };
    const { setItem } = installCache({ folders, sections, bookmarks: [first, second] });
    snapshot = { folders, sections, bookmarks: [first, second], folderSections: [] };
    let failFirst!: (response: Response) => void;
    const firstRequest = new Promise<Response>((resolve) => { failFirst = resolve; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if ((init?.method ?? "GET") === "GET") {
        if (path === "/api/folders") return new Response(JSON.stringify(snapshot.folders), { status: 200 });
        if (path === "/api/sections") return new Response(JSON.stringify(snapshot.sections), { status: 200 });
        if (path === "/api/folder-sections") return new Response(JSON.stringify([]), { status: 200 });
        return new Response(JSON.stringify(snapshot.bookmarks), { status: 200 });
      }
      return path.endsWith("/first")
        ? firstRequest
        : new Response(JSON.stringify({ ...second, isFavorite: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    fireEvent.click(screen.getByRole("button", { name: "First 즐겨찾기" }));
    fireEvent.click(screen.getByRole("button", { name: "Second 즐겨찾기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Second 즐겨찾기" }).querySelector("svg")).toHaveClass("fill-[var(--color-brand)]"));
    await act(async () => {
      failFirst(new Response(JSON.stringify({ detail: "첫 즐겨찾기 저장에 실패했습니다." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }));
      await firstRequest;
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("첫 즐겨찾기 저장에 실패했습니다.");
    expect(screen.getByRole("button", { name: "First 즐겨찾기" }).querySelector("svg")).not.toHaveClass("fill-[var(--color-brand)]");
    expect(screen.getByRole("button", { name: "Second 즐겨찾기" }).querySelector("svg")).toHaveClass("fill-[var(--color-brand)]");
    await waitFor(() => {
      const saved = JSON.parse(String(setItem.mock.calls.at(-1)?.[1]));
      expect(saved.bookmarks).toMatchObject([
        { id: "first", isFavorite: false },
        { id: "second", isFavorite: true }
      ]);
    });
  });

  it("serializes two favorite changes for the same bookmark", async () => {
    const bookmark = { ...bookmarks[0], id: "serial", title: "Serial" };
    let finishFirst!: (response: Response) => void;
    const firstRequest = new Promise<Response>((resolve) => { finishFirst = resolve; });
    let patchCount = 0;
    const { fetchMock } = setup({ folders, sections, bookmarks: [bookmark] }, async () => {
      patchCount += 1;
      return patchCount === 1
        ? firstRequest
        : new Response(JSON.stringify(bookmark), { status: 200 });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    const favorite = screen.getByRole("button", { name: "Serial 즐겨찾기" });
    fireEvent.click(favorite);
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    fireEvent.click(favorite);
    await act(async () => Promise.resolve());
    expect(mutations(fetchMock)).toHaveLength(1);
    await act(async () => {
      finishFirst(new Response(JSON.stringify({ ...bookmark, isFavorite: true }), { status: 200 }));
      await firstRequest;
    });
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(2));
    expect(mutations(fetchMock).map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { isFavorite: true },
      { isFavorite: false }
    ]);
    await waitFor(() => expect(favorite.querySelector("svg")).not.toHaveClass("fill-[var(--color-brand)]"));
  });

  it("refreshes canonical remote data after reorder failure", async () => {
    const cached: BookmarkItem[] = [
      { ...bookmarks[0], id: "cache-a", title: "캐시 첫", position: 0 },
      { ...bookmarks[1], id: "cache-b", title: "캐시 둘", position: 1 }
    ];
    installCache({ folders, sections, bookmarks: cached });
    let bookmarkReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if ((init?.method ?? "GET") === "POST") {
        return new Response(JSON.stringify({ detail: "순서 저장 실패" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (path === "/api/folders") return new Response(JSON.stringify(folders), { status: 200 });
      if (path === "/api/sections") return new Response(JSON.stringify(sections), { status: 200 });
      if (path === "/api/folder-sections") return new Response(JSON.stringify([]), { status: 200 });
      bookmarkReads += 1;
      return new Response(
        JSON.stringify(
          bookmarkReads === 1
            ? cached
            : cached.map((item) => ({ ...item, title: item.id === "cache-a" ? "DB 첫" : "DB 둘" }))
        ),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookmarksPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    fireEvent.dragStart(screen.getByRole("link", { name: /캐시 첫/ }));
    const second = screen.getByRole("link", { name: /캐시 둘/ });
    fireEvent.dragOver(second);
    fireEvent.drop(second);
    expect(await screen.findByRole("alert")).toHaveTextContent("순서 저장 실패");
    expect(await screen.findByRole("link", { name: /DB 첫/ })).toBeInTheDocument();
    expect(bookmarkReads).toBe(2);
    expect(fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === "GET")).toHaveLength(8);
  });

  it("serializes overlapping reorder and preserves the later order after failure", async () => {
    const scoped: BookmarkItem[] = [
      { ...bookmarks[0], id: "a", title: "A", position: 0 },
      { ...bookmarks[1], id: "b", title: "B", position: 1 },
      { ...bookmarks[0], id: "c", title: "C", position: 2 }
    ];
    let failFirst!: (response: Response) => void;
    const firstRequest = new Promise<Response>((resolve) => { failFirst = resolve; });
    let reorderCount = 0;
    const { fetchMock } = setup({ folders, sections, bookmarks: scoped }, async () => {
      reorderCount += 1;
      return reorderCount === 1 ? firstRequest : new Response(null, { status: 204 });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    fireEvent.dragStart(screen.getByRole("link", { name: /^A https:\/\/p1/ }));
    fireEvent.dragOver(screen.getByRole("link", { name: /^B https:\/\/p2/ }));
    fireEvent.drop(screen.getByRole("link", { name: /^B https:\/\/p2/ }));
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    fireEvent.dragStart(screen.getByRole("link", { name: /^A https:\/\/p1/ }));
    fireEvent.dragOver(screen.getByRole("link", { name: /^C https:\/\/p1/ }));
    fireEvent.drop(screen.getByRole("link", { name: /^C https:\/\/p1/ }));
    await act(async () => Promise.resolve());
    expect(mutations(fetchMock)).toHaveLength(1);
    await act(async () => {
      failFirst(new Response(JSON.stringify({ detail: "첫 순서 저장 실패" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }));
      await firstRequest;
    });
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(2));
    const b = screen.getByRole("link", { name: /^B https:\/\/p2/ });
    const c = screen.getByRole("link", { name: /^C https:\/\/p1/ });
    const a = screen.getByRole("link", { name: /^A https:\/\/p1/ });
    expect(b.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(c.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("creates a colored section from the sidebar", async () => {
    const created: Section = {
      id: "section-project",
      name: "프로젝트 섹션",
      color: "#16a34a",
      position: 2
    };
    const { fetchMock } = setup(snapshot, async (input, init) => {
      expect(String(input)).toBe("/api/sections");
      expect(JSON.parse(String(init?.body))).toEqual({
        name: created.name,
        color: created.color
      });
      return new Response(JSON.stringify(created), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    });
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    fireEvent.click(screen.getByRole("button", { name: "새 섹션" }));
    const dialog = screen.getByRole("dialog", { name: "새 섹션" });
    fireEvent.change(within(dialog).getByLabelText("이름"), { target: { value: created.name } });
    fireEvent.click(within(dialog).getByRole("button", { name: `색상 ${created.color}` }));
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(await within(nav).findByRole("button", { name: created.name })).toHaveAttribute("aria-current", "page");
  });

  it("rejects duplicate section names globally", async () => {
    const { fetchMock } = setup();
    fireEvent.click((await screen.findAllByRole("button", { name: "새 섹션" }))[0]);
    const dialog = screen.getByRole("dialog", { name: "새 섹션" });
    fireEvent.change(within(dialog).getByLabelText("이름"), { target: { value: " 지식 " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(within(dialog).getByText("같은 이름의 섹션이 이미 있습니다.")).toBeInTheDocument();
    expect(mutations(fetchMock)).toHaveLength(0);
  });

  it("sends only a changed section name when its color is unchanged", async () => {
    let requestBody: unknown;
    const { fetchMock } = setup(snapshot, async (input, init) => {
      expect(String(input)).toBe("/api/sections/work");
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ...sections[0], name: "업무 수정" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    const menu = await openMenu("업무", nav);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "편집" }));
    const dialog = screen.getByRole("dialog", { name: "섹션 편집" });
    fireEvent.change(within(dialog).getByLabelText("이름"), { target: { value: "업무 수정" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(requestBody).toEqual({ name: "업무 수정" });
    expect(await within(nav).findByRole("button", { name: "업무 수정" })).toBeInTheDocument();
  });

  it("offers deletion for an empty section in the sidebar", async () => {
    const empty: Section = { id: "empty", name: "빈 섹션", color: null, position: 2 };
    setup({ folders, sections: [...sections, empty], bookmarks });
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    expect(await within(nav).findByRole("button", { name: empty.name })).toBeInTheDocument();
    const menu = await openMenu(empty.name, nav);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "삭제" }));
    expect(screen.getByRole("dialog", { name: "섹션 삭제" })).toBeInTheDocument();
  });

  it("shows a Korean retry message instead of a raw database failure", async () => {
    setup(snapshot, async () =>
      new Response(JSON.stringify({ detail: "Database request failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      })
    );
    const nav = await screen.findByRole("navigation", { name: "북마크 폴더" });
    const menu = await openMenu("업무", nav);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "편집" }));
    const dialog = screen.getByRole("dialog", { name: "섹션 편집" });
    fireEvent.change(within(dialog).getByLabelText("이름"), { target: { value: "업무 수정" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(await screen.findByText("데이터베이스 요청에 실패했습니다. 잠시 후 다시 시도하세요.")).toBeInTheDocument();
    expect(screen.queryByText("Database request failed")).not.toBeInTheDocument();
  });

  it("shows a live saving status until the database request finishes", async () => {
    let finishRequest!: (response: Response) => void;
    const request = new Promise<Response>((resolve) => { finishRequest = resolve; });
    setup(snapshot, async () => request);
    fireEvent.click((await screen.findAllByRole("button", { name: "북마크 추가" }))[0]);
    const dialog = screen.getByRole("dialog", { name: "북마크 추가" });
    fireEvent.change(within(dialog).getByLabelText("URL"), { target: { value: "https://example.com" } });
    fireEvent.change(within(dialog).getByLabelText("제목"), { target: { value: "Example" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("status")).toHaveTextContent("데이터베이스에 저장 중");
    expect(screen.getByRole("button", { name: "저장 중..." })).toBeDisabled();
    await act(async () => {
      finishRequest(new Response(JSON.stringify({
        id: "new",
        title: "Example",
        url: "https://example.com/",
        description: null,
        isFavorite: false,
        folderId: "projects",
        position: 2
      }), { status: 201 }));
      await request;
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows a live deleting status until the database request finishes", async () => {
    let finishRequest!: (response: Response) => void;
    const request = new Promise<Response>((resolve) => { finishRequest = resolve; });
    setup(snapshot, async () => request);
    const trigger = await screen.findByRole("button", { name: "프로젝트 A 메뉴" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "삭제" }));
    const dialog = screen.getByRole("dialog", { name: "북마크 삭제" });
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));
    expect(await screen.findByRole("status")).toHaveTextContent("데이터베이스에서 삭제 중");
    expect(within(dialog).getByRole("button", { name: "삭제 중..." })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "닫기" })).toBeDisabled();
    await act(async () => {
      finishRequest(new Response(null, { status: 204 }));
      await request;
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
