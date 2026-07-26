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

  return (
    bookmark.title.toLowerCase().includes(needle) ||
    bookmark.url.toLowerCase().includes(needle) ||
    (bookmark.description ?? "").toLowerCase().includes(needle)
  );
}

export function countBookmarks(bookmarks: BookmarkItem[], filters: BookmarkCountFilters = {}) {
  return bookmarks.filter((bookmark) => matchesBookmarkFilters(bookmark, filters)).length;
}
