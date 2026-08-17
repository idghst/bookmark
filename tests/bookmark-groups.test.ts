import { describe, expect, it } from "vitest";
import { buildBookmarkGroups, visibleFoldersInSubtree } from "@/app/lib/bookmarks/groups";
import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";

const folders: Folder[] = [
  { id: "work", name: "작업", color: "#4f46e5", parentId: null, position: 0 },
  { id: "docs", name: "문서", color: "#2166d7", parentId: "work", position: 0 }
];

const sections: Section[] = [
  { id: "daily", name: "매일", folderId: "work", position: 0 }
];

const bookmarks: BookmarkItem[] = [
  {
    id: "b1",
    title: "A",
    url: "https://a.example",
    description: null,
    isFavorite: false,
    folderId: "work",
    sectionId: "daily",
    position: 0
  },
  {
    id: "b2",
    title: "B",
    url: "https://b.example",
    description: null,
    isFavorite: false,
    folderId: "work",
    sectionId: null,
    position: 1
  }
];

describe("bookmark groups", () => {
  it("walks the selected folder and its descendants", () => {
    const visible = visibleFoldersInSubtree(folders, folders[0], new Set(["work", "docs"]));
    expect(visible.map((folder) => folder.id)).toEqual(["work", "docs"]);
  });

  it("groups assigned and unassigned bookmarks", () => {
    const groups = buildBookmarkGroups(bookmarks, [folders[0]], sections, false);
    expect(groups.map((group) => group.label)).toEqual(["매일", "섹션 없음"]);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[1].items).toHaveLength(1);
  });
});
