import {
  SNAPSHOT_KEY,
  joinSnapshotPayload,
  parseSnapshot,
  serializeSnapshot,
  splitSnapshotPayload,
  type BookmarkSnapshot,
} from "./snapshot";
import { storageDelete, storageGet, storageSet } from "./storage";

const STORAGE_BATCH_SIZE = 8;
let pendingSnapshot: BookmarkSnapshot | null = null;
let saveInFlight: Promise<void> | null = null;
let clearInFlight: Promise<void> | null = null;

async function previousChunkCount(): Promise<number> {
  const header = await storageGet(SNAPSHOT_KEY);
  const count = Number(header);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

async function deleteChunks(from: number, to: number): Promise<void> {
  for (let index = from; index < to; index += STORAGE_BATCH_SIZE) {
    await Promise.all(
      Array.from({ length: Math.min(STORAGE_BATCH_SIZE, to - index) }, (_, offset) =>
        storageDelete(`${SNAPSHOT_KEY}.${index + offset}`),
      ),
    );
  }
}

export async function loadSnapshotCache(): Promise<BookmarkSnapshot | null> {
  try {
    const header = await storageGet(SNAPSHOT_KEY);
    if (!header) return null;
    const count = Number(header);
    if (!Number.isInteger(count) || count < 1) {
      return parseSnapshot(header);
    }
    const chunks: Array<string | null> = [];
    for (let index = 0; index < count; index += STORAGE_BATCH_SIZE) {
      chunks.push(...await Promise.all(
        Array.from({ length: Math.min(STORAGE_BATCH_SIZE, count - index) }, (_, offset) =>
          storageGet(`${SNAPSHOT_KEY}.${index + offset}`),
        ),
      ));
    }
    return parseSnapshot(joinSnapshotPayload(chunks));
  } catch {
    return null;
  }
}

async function writeSnapshot(snapshot: BookmarkSnapshot): Promise<void> {
  const chunks = splitSnapshotPayload(serializeSnapshot(snapshot));
  const previous = await previousChunkCount();
  try {
    for (let index = 0; index < chunks.length; index += STORAGE_BATCH_SIZE) {
      await Promise.all(
        chunks.slice(index, index + STORAGE_BATCH_SIZE).map((chunk, offset) =>
          storageSet(`${SNAPSHOT_KEY}.${index + offset}`, chunk),
        ),
      );
    }
    await storageSet(SNAPSHOT_KEY, String(chunks.length));
    await deleteChunks(chunks.length, previous);
  } catch {
    // ponytail: native kv may reject a chunk; skip cache rather than fail the screen
  }
}

function drainPending(): Promise<void> {
  if (!saveInFlight) {
    saveInFlight = (async () => {
      try {
        while (pendingSnapshot && !clearInFlight) {
          const next = pendingSnapshot;
          pendingSnapshot = null;
          await writeSnapshot(next);
        }
      } finally {
        saveInFlight = null;
      }
    })();
  }
  return saveInFlight;
}

export function saveSnapshotCache(snapshot: BookmarkSnapshot): Promise<void> {
  pendingSnapshot = snapshot;
  return clearInFlight ? clearInFlight.then(drainPending) : drainPending();
}

export function clearSnapshotCache(): Promise<void> {
  pendingSnapshot = null;
  if (!clearInFlight) {
    const activeSave = saveInFlight;
    clearInFlight = (async () => {
      try {
        if (activeSave) await activeSave.catch(() => {});
        const previous = await previousChunkCount();
        await storageDelete(SNAPSHOT_KEY);
        await deleteChunks(0, previous);
      } catch {
        // ignore
      } finally {
        clearInFlight = null;
      }
    })();
  }
  return clearInFlight;
}
