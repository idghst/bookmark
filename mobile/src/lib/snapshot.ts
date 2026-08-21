import type { BookmarkItem, BookmarkPatch, Folder, FolderSection, Section } from "./types";

export const SNAPSHOT_KEY = "bookmark.mobile.snapshot";
export const SNAPSHOT_CHUNK_SIZE = 1800;

export type BookmarkSnapshot = {
  folders: Folder[];
  sections: Section[];
  folderSections: FolderSection[];
  bookmarks: BookmarkItem[];
  savedAt: number;
};

export function parseSnapshot(raw: string | null): BookmarkSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BookmarkSnapshot>;
    if (
      !Array.isArray(parsed.folders) ||
      !Array.isArray(parsed.sections) ||
      !Array.isArray(parsed.folderSections) ||
      !Array.isArray(parsed.bookmarks) ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }
    return {
      folders: parsed.folders,
      sections: parsed.sections,
      folderSections: parsed.folderSections,
      bookmarks: parsed.bookmarks,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function serializeSnapshot(snapshot: BookmarkSnapshot): string {
  return JSON.stringify({
    folders: snapshot.folders,
    sections: snapshot.sections,
    folderSections: snapshot.folderSections,
    bookmarks: snapshot.bookmarks,
    savedAt: snapshot.savedAt,
  });
}

export function applyPendingBookmarks(
  bookmarks: BookmarkItem[],
  pending: ReadonlyMap<string, BookmarkPatch>,
): BookmarkItem[] {
  if (pending.size === 0) return bookmarks;
  return bookmarks.map((item) => {
    const patch = pending.get(item.id);
    return patch ? { ...item, ...patch } : item;
  });
}

export function mutationsDisabled(hasData: boolean): boolean {
  return !hasData;
}

export function splitSnapshotPayload(raw: string, size = SNAPSHOT_CHUNK_SIZE): string[] {
  if (!raw) return [];
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of raw) {
    const charBytes = encoder.encode(char).byteLength;
    if (current && currentBytes + charBytes > size) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function joinSnapshotPayload(chunks: Array<string | null>): string | null {
  if (chunks.length === 0 || chunks.some((chunk) => chunk == null)) return null;
  return chunks.join("");
}
