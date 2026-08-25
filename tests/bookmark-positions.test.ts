import { describe, expect, it } from "vitest";
import {
  applyPositions,
  getPositionChanges,
  insertIndexFromPointer,
  moveById,
  moveToIndex,
  normalizePositions,
  scrollFromPointer,
  updateMatchingPositions
} from "@/app/lib/bookmarks/positions";

describe("bookmark positions", () => {
  it("renumbers items from zero", () => {
    expect(normalizePositions([{ id: "a", position: 4 }, { id: "b", position: 9 }])).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 }
    ]);
  });

  it("moves an item and renormalizes sibling positions", () => {
    const items = [
      { id: "a", position: 0 },
      { id: "b", position: 1 },
      { id: "c", position: 2 }
    ];
    expect(moveById(items, "c", "a")).toEqual([
      { id: "c", position: 0 },
      { id: "a", position: 1 },
      { id: "b", position: 2 }
    ]);
  });

  it("inserts before or after a target from pointer Y", () => {
    const rect = { top: 100, height: 40 };
    expect(insertIndexFromPointer(110, rect, 2)).toBe(2);
    expect(insertIndexFromPointer(130, rect, 2)).toBe(3);
    expect(insertIndexFromPointer(0, { top: 0, height: 0 }, 1)).toBe(2);
  });

  it("scrolls a container when the pointer sits on an edge", () => {
    const box = { getBoundingClientRect: () => ({ top: 0, bottom: 200 }), scrollTop: 80 };
    scrollFromPointer(box, 10);
    expect(box.scrollTop).toBe(62);
    scrollFromPointer(box, 190);
    expect(box.scrollTop).toBe(80);
    scrollFromPointer(box, 100);
    expect(box.scrollTop).toBe(80);
  });

  it("moves an item to an insert index without swapping past the intended gap", () => {
    const items = [
      { id: "a", position: 0 },
      { id: "b", position: 1 },
      { id: "c", position: 2 }
    ];
    expect(moveToIndex(items, "a", 3)).toEqual([
      { id: "b", position: 0 },
      { id: "c", position: 1 },
      { id: "a", position: 2 }
    ]);
    expect(moveToIndex(items, "c", 1)).toEqual([
      { id: "a", position: 0 },
      { id: "c", position: 1 },
      { id: "b", position: 2 }
    ]);
    expect(moveToIndex(items, "a", 1)).toEqual(items);
  });

  it("records only changed positions and can roll them back", () => {
    const previous = [
      { id: "a", position: 0 },
      { id: "b", position: 1 }
    ];
    const optimistic = [
      { id: "b", position: 0 },
      { id: "a", position: 1 }
    ];
    const changes = getPositionChanges(previous, optimistic);
    expect(changes).toEqual([
      { id: "b", previousPosition: 1, optimisticPosition: 0 },
      { id: "a", previousPosition: 0, optimisticPosition: 1 }
    ]);
    expect(updateMatchingPositions(optimistic, changes, "rollback")).toEqual([
      { id: "b", position: 1 },
      { id: "a", position: 0 }
    ]);
    expect(applyPositions(previous, optimistic)).toEqual([
      { id: "a", position: 1 },
      { id: "b", position: 0 }
    ]);
  });
});
