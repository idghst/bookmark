import { NO_SECTION } from "@/app/lib/bookmarks/constants";
import { folderSectionId } from "@/app/lib/bookmarks/folder-tree";
import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";

export type BookmarkGroup = {
  key: string;
  label: string;
  folder: Folder;
  items: BookmarkItem[];
};

const byPosition = <T extends { position: number; name: string }>(a: T, b: T) =>
  a.position - b.position || a.name.localeCompare(b.name, "ko");

export function buildSidebarGroups(sections: Section[], folders: Folder[]) {
  const groups = [...sections]
    .sort(byPosition)
    .map((section) => ({
      section,
      folders: folders.filter((folder) => folderSectionId(folder) === section.id).sort(byPosition)
    }));
  const unassigned = folders.filter((folder) => folderSectionId(folder) === null).sort(byPosition);
  return unassigned.length ? [...groups, { section: null, folders: unassigned }] : groups;
}

export function buildBookmarkGroups(
  filtered: BookmarkItem[],
  visibleFolders: Folder[],
  hasActiveFilter: boolean
): BookmarkGroup[] {
  const itemsByFolder = new Map<string, BookmarkItem[]>();
  filtered.forEach((bookmark) => {
    if (!bookmark.folderId) return;
    itemsByFolder.set(bookmark.folderId, [...(itemsByFolder.get(bookmark.folderId) ?? []), bookmark]);
  });

  return visibleFolders.flatMap((folder) => {
    const items = itemsByFolder.get(folder.id) ?? [];
    return items.length || !hasActiveFilter
      ? [{ key: `${folder.id}:${NO_SECTION}`, label: folder.name, folder, items }]
      : [];
  });
}
