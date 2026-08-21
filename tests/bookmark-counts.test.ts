import { describe, expect, it } from "vitest";
import { countBookmarks, matchesBookmarkFilters } from "@/app/lib/bookmarks/counts";
import { findSectionByName } from "@/app/lib/bookmarks/sections";
import type { BookmarkItem } from "@/app/lib/bookmarks/types";

const bookmarks: BookmarkItem[] = [
  { id: "b1", title: "BNK mail", url: "https://outlook.office.com/mail", description: null, isFavorite: true, folderId: "bnk", position: 0 },
  { id: "b2", title: "BNK guide", url: "https://bookmark.idghst.co.kr", description: null, isFavorite: false, folderId: "bnk", position: 1 },
  { id: "r1", title: "RPA", url: "https://example.com/rpa", description: "자동화", isFavorite: true, folderId: "rpa", position: 2 },
  { id: "n1", title: "IDGHST", url: "https://www.notion.so/idghst", description: null, isFavorite: false, folderId: "notion", position: 3 },
  { id: "n2", title: "캘린더", url: "https://calendar.notion.so", description: null, isFavorite: false, folderId: "notion", position: 4 }
];

describe("bookmark count filters", () => {
  it("counts total bookmarks by folder when favorite filter is off", () => {
    expect(countBookmarks(bookmarks, { folderId: "bnk" })).toBe(2);
    expect(countBookmarks(bookmarks, { folderId: "notion" })).toBe(2);
  });

  it("counts only favorites by folder when favorite filter is on", () => {
    expect(countBookmarks(bookmarks, { folderId: "bnk", favoriteOnly: true })).toBe(1);
    expect(countBookmarks(bookmarks, { folderId: "rpa", favoriteOnly: true })).toBe(1);
    expect(countBookmarks(bookmarks, { folderId: "notion", favoriteOnly: true })).toBe(0);
  });

  it("applies query and favorite filters together", () => {
    expect(countBookmarks(bookmarks, { folderId: "bnk", favoriteOnly: true, query: "mail" })).toBe(1);
    expect(countBookmarks(bookmarks, { folderId: "bnk", favoriteOnly: true, query: "guide" })).toBe(0);
  });

  it("matches title, url, and description for search", () => {
    expect(matchesBookmarkFilters(bookmarks[2], { query: "자동화" })).toBe(true);
    expect(matchesBookmarkFilters(bookmarks[3], { query: "notion.so" })).toBe(true);
  });
});

it("finds a section by trimmed case-insensitive global name", () => {
  const sections = [
    { id: "s1", name: "Frontend", position: 0 },
    { id: "s2", name: "Backend", position: 1 }
  ];

  expect(findSectionByName(sections, " frontend ")?.id).toBe("s1");
});
