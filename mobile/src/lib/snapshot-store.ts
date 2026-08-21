import {
  SNAPSHOT_KEY,
  joinSnapshotPayload,
  parseSnapshot,
  serializeSnapshot,
  splitSnapshotPayload,
  type BookmarkSnapshot,
} from "./snapshot";
import { storageDelete, storageGet, storageSet } from "./storage";

async function previousChunkCount(): Promise<number> {
  const header = await storageGet(SNAPSHOT_KEY);
  const count = Number(header);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

export async function loadSnapshotCache(): Promise<BookmarkSnapshot | null> {
  try {
    const header = await storageGet(SNAPSHOT_KEY);
    if (!header) return null;
    const count = Number(header);
    if (!Number.isInteger(count) || count < 1) {
      return parseSnapshot(header);
    }
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) => storageGet(`${SNAPSHOT_KEY}.${index}`)),
    );
    return parseSnapshot(joinSnapshotPayload(chunks));
  } catch {
    return null;
  }
}

export async function saveSnapshotCache(snapshot: BookmarkSnapshot): Promise<void> {
  const chunks = splitSnapshotPayload(serializeSnapshot(snapshot));
  const previous = await previousChunkCount();
  try {
    await Promise.all(chunks.map((chunk, index) => storageSet(`${SNAPSHOT_KEY}.${index}`, chunk)));
    await storageSet(SNAPSHOT_KEY, String(chunks.length));
    await Promise.all(
      Array.from({ length: Math.max(0, previous - chunks.length) }, (_, index) =>
        storageDelete(`${SNAPSHOT_KEY}.${previous - index - 1}`),
      ),
    );
  } catch {
    // ponytail: native kv may reject a chunk; skip cache rather than fail the screen
  }
}

export async function clearSnapshotCache(): Promise<void> {
  try {
    const previous = await previousChunkCount();
    await Promise.all([
      storageDelete(SNAPSHOT_KEY),
      ...Array.from({ length: previous }, (_, index) => storageDelete(`${SNAPSHOT_KEY}.${index}`)),
    ]);
  } catch {
    // ignore
  }
}