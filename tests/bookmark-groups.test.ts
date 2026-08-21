import { describe, expect, it } from "vitest";
import { buildBookmarkGroups, buildSidebarGroups } from "@/app/lib/bookmarks/groups";
import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";

const folders: Folder[] = [
  { id: "docs", name: "문서", color: "#2166d7", sectionId: "knowledge", position: 1 },
  { id: "work", name: "작업", color: "#4f46e5", sectionId: "business", position: 0 },
  { id: "tools", name: "도구", color: "#16a34a", sectionId: "business", position: 1 },
  { id: "loose", name: "미분류", color: null, sectionId: null, position: 0 }
];

const sections: Section[] = [
  { id: "empty", name: "빈 섹션", position: 2 },
  { id: "knowledge", name: "지식", position: 1 },
  { id: "business", name: "업무", position: 0 }
];

const bookmarks: BookmarkItem[] = [
  {
    id: "b1",
    title: "A",
    url: "https://a.example",
    description: null,
    isFavorite: false,
    folderId: "work",
    folderSectionId: "work-read",
    position: 0
  },
  {
    id: "b2",
    title: "B",
    url: "https://b.example",
    description: null,
    isFavorite: false,
    folderId: "tools",
    folderSectionId: null,
    position: 0
  },
  {
    id: "b3",
    title: "C",
    url: "https://c.example",
    description: null,
    isFavorite: false,
    folderId: "work",
    folderSectionId: null,
    position: 1
  }
];

const folderSections = [
  { id: "work-read", name: "읽을 글", folderId: "work", position: 0 }
];

describe("bookmark groups", () => {
  it("builds ordered section groups, keeps empty sections, and appends non-empty unassigned folders", () => {
    const groups = buildSidebarGroups(sections, folders);
    expect(groups.map((group) => group.section?.id ?? null)).toEqual(["business", "knowledge", "empty", null]);
    expect(groups[0].folders.map((folder) => folder.id)).toEqual(["work", "tools"]);
    expect(groups[2].folders).toEqual([]);
    expect(groups[3].folders.map((folder) => folder.id)).toEqual(["loose"]);
  });

  it("groups bookmarks by visible folder and removes empty groups only while filtering", () => {
    const visible = [folders[1], folders[2]];
    expect(buildBookmarkGroups(bookmarks, visible, [], false).map((group) => group.label)).toEqual(["작업", "도구"]);
    expect(buildBookmarkGroups(bookmarks.slice(0, 1), visible, [], true).map((group) => group.label)).toEqual(["작업"]);
  });

  it("keeps folder-owned sections separate and always shows 섹션 없음", () => {
    const visible = [folders[1]];
    const groups = buildBookmarkGroups(bookmarks, visible, folderSections, false);
    expect(groups.map((group) => [group.label, group.folderSection?.id ?? null, group.items.map((item) => item.id)])).toEqual([
      ["읽을 글", "work-read", ["b1"]],
      ["섹션 없음", null, ["b3"]]
    ]);
  });

  it("labels the unassigned bucket 섹션 없음 when a folder is the current view", () => {
    const visible = [folders[1]];
    expect(buildBookmarkGroups(bookmarks, visible, [], false, true).map((group) => group.label)).toEqual(["섹션 없음"]);
  });
});
