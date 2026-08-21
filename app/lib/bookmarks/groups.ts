import { NO_SECTION } from "@/app/lib/bookmarks/constants";
import { folderSectionId } from "@/app/lib/bookmarks/folder-tree";
import type { BookmarkItem, Folder, FolderSection, Section } from "@/app/lib/bookmarks/types";

export type BookmarkGroup = {
  key: string;
  label: string;
  folder: Folder;
  folderSection: FolderSection | null;
  items: BookmarkItem[];
};

export function bookmarkFolderSectionId(bookmark: Pick<BookmarkItem, "folderSectionId">) {
  return bookmark.folderSectionId ?? null;
}

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

function sectionLabel(folder: Folder, folderSection: FolderSection | null, multipleFolders: boolean) {
  const name = folderSection?.name ?? "섹션 없음";
  return multipleFolders ? `${folder.name} · ${name}` : name;
}

export function buildBookmarkGroups(
  filtered: BookmarkItem[],
  visibleFolders: Folder[],
  folderSections: FolderSection[],
  hasActiveFilter: boolean,
  alwaysShowUnsectioned = false
): BookmarkGroup[] {
  const multipleFolders = visibleFolders.length > 1;
  const knownIds = new Set(folderSections.map((section) => section.id));
  const itemsByKey = new Map<string, BookmarkItem[]>();
  filtered.forEach((bookmark) => {
    if (!bookmark.folderId) return;
    const sectionId = bookmarkFolderSectionId(bookmark);
    const key = `${bookmark.folderId}:${sectionId && knownIds.has(sectionId) ? sectionId : NO_SECTION}`;
    itemsByKey.set(key, [...(itemsByKey.get(key) ?? []), bookmark]);
  });

  return visibleFolders.flatMap((folder) => {
    const owned = folderSections
      .filter((section) => section.folderId === folder.id)
      .sort(byPosition);
    const unsectioned = {
      key: `${folder.id}:${NO_SECTION}`,
      label: owned.length || alwaysShowUnsectioned
        ? sectionLabel(folder, null, multipleFolders)
        : folder.name,
      folder,
      folderSection: null,
      items: itemsByKey.get(`${folder.id}:${NO_SECTION}`) ?? []
    };
    const groups = owned.length
      ? [
          ...owned.map((folderSection) => ({
            key: `${folder.id}:${folderSection.id}`,
            label: sectionLabel(folder, folderSection, multipleFolders),
            folder,
            folderSection,
            items: itemsByKey.get(`${folder.id}:${folderSection.id}`) ?? []
          })),
          unsectioned
        ]
      : [unsectioned];
    return hasActiveFilter ? groups.filter((group) => group.items.length) : groups;
  });
}
