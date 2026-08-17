import { STORAGE_KEY } from "@/app/lib/bookmarks/constants";
import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";

export type BookmarkCache = {
  version: 2;
  apiBacked: boolean;
  savedAt: number;
  folders: Folder[];
  sections: Section[];
  bookmarks: BookmarkItem[];
  selectedFolderId?: string;
};

export function readBookmarkCache() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;

  const parsed = JSON.parse(saved) as Partial<BookmarkCache>;
  if (!parsed.folders?.length || !Array.isArray(parsed.sections) || !Array.isArray(parsed.bookmarks)) return null;
  return parsed;
}

export function writeBookmarkCache(cache: BookmarkCache) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}
