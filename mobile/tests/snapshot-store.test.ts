import { beforeEach, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => {
  const values = new Map<string, string>();
  let active = 0;
  let peak = 0;
  let activeReads = 0;
  let peakReads = 0;
  let activeDeletes = 0;
  let peakDeletes = 0;
  return {
    values,
    reset: () => { values.clear(); active = 0; peak = 0; activeReads = 0; peakReads = 0; activeDeletes = 0; peakDeletes = 0; },
    peak: () => peak,
    peakReads: () => peakReads,
    peakDeletes: () => peakDeletes,
    get: vi.fn(async (key: string) => {
      activeReads += 1;
      peakReads = Math.max(peakReads, activeReads);
      await new Promise((resolve) => setTimeout(resolve, 1));
      const value = values.get(key) ?? null;
      activeReads -= 1;
      return value;
    }),
    set: vi.fn(async (key: string, value: string) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      values.set(key, value);
      active -= 1;
    }),
    delete: vi.fn(async (key: string) => {
      activeDeletes += 1;
      peakDeletes = Math.max(peakDeletes, activeDeletes);
      await new Promise((resolve) => setTimeout(resolve, 1));
      values.delete(key);
      activeDeletes -= 1;
    }),
  };
});

vi.mock("@/lib/storage", () => ({
  storageGet: storage.get,
  storageSet: storage.set,
  storageDelete: storage.delete,
}));

import { clearSnapshotCache, loadSnapshotCache, saveSnapshotCache } from "../src/lib/snapshot-store";
import { serializeSnapshot, splitSnapshotPayload } from "../src/lib/snapshot";

beforeEach(() => { storage.reset(); vi.clearAllMocks(); });

function largeSnapshot(savedAt = 1) {
  return {
    folders: [], sections: [], folderSections: [], savedAt,
    bookmarks: Array.from({ length: 120 }, (_, index) => ({
      id: String(index), title: `Bookmark ${index}`, url: `https://example.com/${index}`,
      description: "x".repeat(1800), isFavorite: false, folderId: null, position: index,
    })),
  };
}

it("bounds simultaneous native writes for a large snapshot", async () => {
  const snapshot = largeSnapshot();

  await saveSnapshotCache(snapshot);

  expect(storage.peak()).toBeLessThanOrEqual(8);
  expect(await loadSnapshotCache()).toEqual(snapshot);
});

it("coalesces overlapping saves and retains the newest snapshot", async () => {
  const snapshots = Array.from({ length: 10 }, (_, index) => largeSnapshot(index));

  await Promise.all(snapshots.map(saveSnapshotCache));

  const chunkCount = splitSnapshotPayload(serializeSnapshot(snapshots[0])).length;
  expect(storage.set.mock.calls.length).toBeLessThanOrEqual((chunkCount + 1) * 2);
  expect(await loadSnapshotCache()).toEqual(snapshots.at(-1));
});

it("bounds simultaneous native reads while restoring a large snapshot", async () => {
  const snapshot = largeSnapshot();
  await saveSnapshotCache(snapshot);

  expect(await loadSnapshotCache()).toEqual(snapshot);
  expect(storage.peakReads()).toBeLessThanOrEqual(8);
});

it("bounds stale chunk deletions when a smaller snapshot replaces a large one", async () => {
  await saveSnapshotCache(largeSnapshot());
  const smaller = { ...largeSnapshot(2), bookmarks: [] };

  await saveSnapshotCache(smaller);

  expect(storage.peakDeletes()).toBeLessThanOrEqual(8);
  expect(await loadSnapshotCache()).toEqual(smaller);
  expect(storage.values.size).toBe(2);
});

it("clears an in-flight save without restoring the removed snapshot", async () => {
  const saving = saveSnapshotCache(largeSnapshot());
  await Promise.resolve();

  await Promise.all([saving, clearSnapshotCache()]);

  expect((await loadSnapshotCache()) === null).toBe(true);
  expect(storage.values.size).toBe(0);
});

it("persists a new save requested during clear after the cache is removed", async () => {
  const oldSave = saveSnapshotCache(largeSnapshot());
  const clearing = clearSnapshotCache();
  const newest = { ...largeSnapshot(2), bookmarks: [] };

  await Promise.all([oldSave, clearing, saveSnapshotCache(newest)]);

  expect(await loadSnapshotCache()).toEqual(newest);
  expect(storage.values.size).toBe(2);
});
