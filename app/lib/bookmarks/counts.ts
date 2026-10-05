import type { BookmarkItem } from "@/app/lib/bookmarks/types";

type BookmarkCountFilters = {
  folderId?: string | null;
  favoriteOnly?: boolean;
  query?: string;
};

export function matchesBookmarkFilters(bookmark: BookmarkItem, filters: BookmarkCountFilters = {}) {
  if (filters.folderId !== undefined && bookmark.folderId !== filters.folderId) return false;
  if (filters.favoriteOnly && !bookmark.isFavorite) return false;

  const needle = filters.query?.trim().toLowerCase();
  if (!needle) return true;

  const fields = [bookmark.title, bookmark.url, bookmark.description ?? ""].map((value) => value.toLowerCase());
  return needle.split(/\s+/).every((word) => fields.some((field) => field.includes(word)));
}

export function countBookmarks(bookmarks: BookmarkItem[], filters: BookmarkCountFilters = {}) {
  return bookmarks.filter((bookmark) => matchesBookmarkFilters(bookmark, filters)).length;
}
