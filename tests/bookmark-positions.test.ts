import { describe, expect, it } from "vitest";
import {
  applyPositions,
  getPositionChanges,
  moveById,
  normalizePositions,
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
