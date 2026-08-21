import { STORAGE_KEY } from "@/app/lib/bookmarks/constants";
import type { BookmarkItem, Folder, FolderSection, Section } from "@/app/lib/bookmarks/types";

export type BookmarkCacheSnapshot = {
  folders: Folder[];
  sections: Section[];
  folderSections: FolderSection[];
  bookmarks: BookmarkItem[];
  savedAt: number;
  apiBacked?: boolean;
  selection?: { kind: "folder" | "section"; id: string };
  version?: number;
};

export type BookmarkCache = BookmarkCacheSnapshot;

const CACHE_VERSION = 4;

function browserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readBookmarkCache(): BookmarkCacheSnapshot | null {
  const storage = browserStorage();
  if (!storage) return null;

  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved) as Partial<BookmarkCacheSnapshot>;
    if (
      !Array.isArray(parsed.folders) ||
      !Array.isArray(parsed.sections) ||
      !Array.isArray(parsed.bookmarks) ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }

    return {
      ...parsed,
      folders: parsed.folders,
      sections: parsed.sections,
      folderSections: Array.isArray(parsed.folderSections) ? parsed.folderSections : [],
      bookmarks: parsed.bookmarks,
      savedAt: parsed.savedAt
    };
  } catch {
    return null;
  }
}

export function writeBookmarkCache(snapshot: BookmarkCacheSnapshot) {
  const storage = browserStorage();
  if (!storage) return;

  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...snapshot,
      folderSections: snapshot.folderSections ?? [],
      version: CACHE_VERSION
    })
  );
}
