import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyPendingBookmarks,
  joinSnapshotPayload,
  mutationsDisabled,
  parseSnapshot,
  serializeSnapshot,
  splitSnapshotPayload,
} from "./snapshot.ts";
import type { BookmarkItem, Folder, FolderSection, Section } from "./types.ts";

const folders: Folder[] = [{ id: "docs", name: "문서", color: "#2166d7", sectionId: "work", position: 0 }];
const sections: Section[] = [{ id: "work", name: "업무", color: "#4f46e5", position: 0 }];
const folderSections: FolderSection[] = [
  { id: "docs-a", name: "A", folderId: "docs", position: 0 },
];
const bookmarks: BookmarkItem[] = [
  {
    id: "b1",
    title: "문서 A",
    url: "https://a.example.com",
    description: null,
    isFavorite: false,
    folderId: "docs",
    folderSectionId: "docs-a",
    position: 0,
  },
];

describe("parseSnapshot", () => {
  it("returns null for missing or invalid payloads", () => {
    assert.equal(parseSnapshot(null), null);
    assert.equal(parseSnapshot(""), null);
    assert.equal(parseSnapshot("{"), null);
    assert.equal(parseSnapshot(JSON.stringify({ folders, sections, bookmarks, savedAt: 1 })), null);
  });

  it("reads the web-shaped snapshot fields", () => {
    const parsed = parseSnapshot(
      JSON.stringify({
        folders,
        sections,
        folderSections,
        bookmarks,
        savedAt: 1700000000000,
        extra: true,
      }),
    );
    assert.deepEqual(parsed, { folders, sections, folderSections, bookmarks, savedAt: 1700000000000 });
  });

  it("round-trips through serializeSnapshot", () => {
    const snapshot = { folders, sections, folderSections, bookmarks, savedAt: 42 };
    assert.deepEqual(parseSnapshot(serializeSnapshot(snapshot)), snapshot);
  });
});

describe("loading vs refresh", () => {
  it("blocks mutations only when there is no local data", () => {
    assert.equal(mutationsDisabled(false), true);
    assert.equal(mutationsDisabled(true), false);
  });
});

describe("optimistic reconcile", () => {
  it("keeps in-flight bookmark moves over a stale remote snapshot", () => {
    const remote: BookmarkItem[] = [
      { ...bookmarks[0], folderId: "docs", folderSectionId: "docs-a", isFavorite: false },
    ];
    const pending = new Map([
      ["b1", { folderId: "inbox", folderSectionId: null, isFavorite: true }],
    ]);
    const next = applyPendingBookmarks(remote, pending);
    assert.equal(next[0].folderId, "inbox");
    assert.equal(next[0].folderSectionId, null);
    assert.equal(next[0].isFavorite, true);
    assert.equal(remote[0].folderId, "docs");
  });
});

describe("snapshot chunks", () => {
  it("splits and joins a payload larger than the SecureStore limit", () => {
    const raw = "x".repeat(4000);
    const chunks = splitSnapshotPayload(raw, 1800);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].length, 1800);
    assert.equal(joinSnapshotPayload(chunks), raw);
    assert.equal(joinSnapshotPayload([chunks[0], null]), null);
  });

  it("splits by UTF-8 bytes so Korean payloads fit SecureStore", () => {
    const raw = "한".repeat(1000);
    const chunks = splitSnapshotPayload(raw, 1800);
    const encoder = new TextEncoder();
    assert.ok(chunks.length >= 2);
    for (const chunk of chunks) {
      assert.ok(encoder.encode(chunk).byteLength <= 1800);
    }
    assert.equal(joinSnapshotPayload(chunks), raw);
  });
});
