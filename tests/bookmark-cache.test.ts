import { beforeEach, describe, expect, it } from "vitest";
import { readBookmarkCache, writeBookmarkCache } from "@/app/lib/bookmarks/cache";
import type { BookmarkCacheSnapshot } from "@/app/lib/bookmarks/cache";
import { STORAGE_KEY } from "@/app/lib/bookmarks/constants";
import type { BookmarkItem, Folder, FolderSection, Section } from "@/app/lib/bookmarks/types";

const folders: Folder[] = [
  { id: "work", name: "작업", color: "#4f46e5", sectionId: "business", position: 0 }
];
const sections: Section[] = [{ id: "business", name: "업무", color: "#4f46e5", position: 0 }];
const folderSections: FolderSection[] = [
  { id: "work-read", name: "읽을 글", color: null, folderId: "work", position: 0 }
];
const bookmarks: BookmarkItem[] = [
  {
    id: "b1",
    title: "A",
    url: "https://a.example",
    description: null,
    isFavorite: false,
    folderId: "work",
    folderSectionId: "work-read",
    position: 0
  }
];

function snapshot(overrides: Partial<BookmarkCacheSnapshot> = {}): BookmarkCacheSnapshot {
  return {
    folders,
    sections,
    folderSections,
    bookmarks,
    savedAt: 1_700_000_000_000,
    ...overrides
  };
}

function installMemoryStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      }
    }
  });
}

describe("bookmark cache snapshot", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it("round-trips a full screen snapshot so a later load can read it immediately", () => {
    const saved = snapshot({
      apiBacked: true,
      selection: { kind: "folder", id: "work" }
    });
    writeBookmarkCache(saved);
    expect(readBookmarkCache()).toMatchObject(saved);
    expect(readBookmarkCache()).toMatchObject(saved);
  });

  it("returns empty collections instead of ignoring a written snapshot", () => {
    const empty = snapshot({
      folders: [],
      sections: [],
      folderSections: [],
      bookmarks: [],
      savedAt: 42
    });
    writeBookmarkCache(empty);
    expect(readBookmarkCache()).toMatchObject(empty);
  });

  it("defaults missing folderSections to an empty list", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 3,
        folders,
        sections,
        bookmarks,
        savedAt: 99
      })
    );
    expect(readBookmarkCache()?.folderSections).toEqual([]);
  });

  it("ignores a previous cache key after the snapshot fields grow", () => {
    window.localStorage.setItem(
      "bookmark-cache-v3",
      JSON.stringify({ version: 3, folders, sections, folderSections, bookmarks, savedAt: 1 })
    );
    expect(STORAGE_KEY).not.toBe("bookmark-cache-v3");
    expect(readBookmarkCache()).toBeNull();
  });

  it("returns null for broken JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not-json");
    expect(readBookmarkCache()).toBeNull();
  });

  it("does not throw when localStorage quota is exceeded", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("quota", "QuotaExceededError");
        },
        removeItem: () => undefined
      }
    });
    expect(() => writeBookmarkCache(snapshot())).not.toThrow();
  });

  it("returns null and no-ops when window is missing", () => {
    const saved = snapshot();
    const previous = globalThis.window;
    Reflect.deleteProperty(globalThis, "window");
    try {
      expect(readBookmarkCache()).toBeNull();
      expect(() => writeBookmarkCache(saved)).not.toThrow();
    } finally {
      globalThis.window = previous;
    }
  });
});
