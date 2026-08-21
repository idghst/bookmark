import { describe, expect, it } from "vitest";
import { flattenFolderResponse, normalizeFolderPositions } from "@/app/lib/bookmarks/folder-tree";
import type { Folder } from "@/app/lib/bookmarks/types";

describe("folder response helpers", () => {
  it("normalizes section_id in flat folder responses", () => {
    expect(
      flattenFolderResponse([
        {
          id: "work",
          name: "작업",
          color: null,
          section_id: "business",
          position: 1
        },
        { id: "personal", name: "개인", color: null, sectionId: null, position: 0 }
      ])
    ).toEqual([
      { id: "work", name: "작업", color: null, sectionId: "business", position: 0 },
      { id: "personal", name: "개인", color: null, sectionId: null, position: 0 }
    ]);
  });

  it("normalizes positions independently within each section", () => {
    const folders: Folder[] = [
      { id: "a-2", name: "A2", color: null, sectionId: "a", position: 9 },
      { id: "none", name: "없음", color: null, sectionId: null, position: 4 },
      { id: "a-1", name: "A1", color: null, sectionId: "a", position: 2 },
      { id: "b-1", name: "B1", color: null, sectionId: "b", position: 7 }
    ];

    expect(normalizeFolderPositions(folders)).toMatchObject([
      { id: "a-2", position: 1 },
      { id: "none", position: 0 },
      { id: "a-1", position: 0 },
      { id: "b-1", position: 0 }
    ]);
  });
});
