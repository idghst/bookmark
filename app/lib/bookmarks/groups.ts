import { NO_SECTION } from "@/app/lib/bookmarks/constants";
import { folderParentId } from "@/app/lib/bookmarks/folder-tree";
import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";

export type BookmarkGroup = {
  key: string;
  label: string;
  folder: Folder;
  section: Section | null;
  items: BookmarkItem[];
};

export function visibleFoldersInSubtree(folders: Folder[], selectedFolder: Folder, visibleFolderIds: Set<string>) {
  const childrenByParent = new Map<string, Folder[]>();
  folders.forEach((folder) => {
    const parentId = folderParentId(folder);
    if (!parentId || !visibleFolderIds.has(folder.id) || !visibleFolderIds.has(parentId)) return;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), folder]);
  });
  childrenByParent.forEach((children) => {
    children.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "ko"));
  });

  const ordered: Folder[] = [];
  const seen = new Set<string>();
  const visit = (folder: Folder) => {
    if (seen.has(folder.id)) return;
    seen.add(folder.id);
    ordered.push(folder);
    (childrenByParent.get(folder.id) ?? []).forEach(visit);
  };
  visit(selectedFolder);
  return ordered;
}

export function buildBookmarkGroups(
  filtered: BookmarkItem[],
  visibleFolders: Folder[],
  sections: Section[],
  hasActiveFilter: boolean
): BookmarkGroup[] {
  const itemsByScope = new Map<string, BookmarkItem[]>();
  const scopeKey = (folderId: string, sectionId: string | null) => `${folderId}:${sectionId ?? NO_SECTION}`;
  filtered.forEach((bookmark) => {
    if (!bookmark.folderId) return;
    const key = scopeKey(bookmark.folderId, bookmark.sectionId);
    itemsByScope.set(key, [...(itemsByScope.get(key) ?? []), bookmark]);
  });

  const showFolderName = visibleFolders.length > 1;
  return visibleFolders.flatMap((folder) => {
    const folderSections = sections
      .filter((section) => section.folderId === folder.id)
      .sort((a, b) => a.position - b.position);
    const sectionIds = new Set(folderSections.map((section) => section.id));
    const sectionGroups = folderSections.flatMap((section) => {
      const items = itemsByScope.get(scopeKey(folder.id, section.id)) ?? [];
      return items.length || !hasActiveFilter
        ? [
            {
              key: scopeKey(folder.id, section.id),
              label: showFolderName ? `${folder.name} · ${section.name}` : section.name,
              folder,
              section,
              items
            }
          ]
        : [];
    });
    const unassigned = filtered.filter(
      (bookmark) =>
        bookmark.folderId === folder.id && (bookmark.sectionId === null || !sectionIds.has(bookmark.sectionId))
    );
    return unassigned.length
      ? [
          ...sectionGroups,
          {
            key: scopeKey(folder.id, null),
            label: showFolderName ? `${folder.name} · 섹션 없음` : "섹션 없음",
            folder,
            section: null,
            items: unassigned
          }
        ]
      : sectionGroups;
  });
}
