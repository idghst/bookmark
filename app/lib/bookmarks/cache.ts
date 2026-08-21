import { STORAGE_KEY } from "@/app/lib/bookmarks/constants";
import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";

export type BookmarkCache = {
  version: 3;
  apiBacked: boolean;
  savedAt: number;
  folders: Folder[];
  sections: Section[];
  bookmarks: BookmarkItem[];
  selection?: { kind: "folder" | "section"; id: string };
};

export function readBookmarkCache() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;

  const parsed = JSON.parse(saved) as Partial<BookmarkCache>;
  if (
    parsed.version !== 3 ||
    !parsed.folders?.length ||
    !Array.isArray(parsed.sections) ||
    !Array.isArray(parsed.bookmarks)
  ) return null;
  return parsed as BookmarkCache;
}

export function writeBookmarkCache(cache: BookmarkCache) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}
