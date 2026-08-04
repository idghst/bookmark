import { describe, expect, it } from "vitest";
import {
  buildFolderTree,
  flattenFolderTree,
  flattenFolderResponse,
  folderDescendantIds
} from "@/app/lib/bookmarks/folder-tree";
import type { Folder } from "@/app/lib/bookmarks/types";

describe("folder tree helpers", () => {
  it("normalizes flat and nested API folder responses to parentId", () => {
    expect(
      flattenFolderResponse([
        {
          id: "root",
          name: "루트",
          color: null,
          position: 0,
          children: [
            { id: "child", name: "자식", color: null, position: 0 }
          ]
        },
        { id: "legacy", name: "레거시", color: null, parent_id: "root", position: 1 }
      ])
    ).toMatchObject([
      { id: "root", parentId: null, position: 0 },
      { id: "child", parentId: "root", position: 0 },
      { id: "legacy", parentId: "root", position: 1 }
    ]);
  });

  it("renders sibling positions as a nested tree and finds descendants", () => {
    const folders: Folder[] = [
      { id: "root", name: "루트", color: null, parentId: null, position: 1 },
      { id: "child", name: "자식", color: null, parentId: "root", position: 0 },
      { id: "grandchild", name: "손자", color: null, parentId: "child", position: 0 },
      { id: "other", name: "다른 루트", color: null, parentId: null, position: 0 }
    ];

    const tree = buildFolderTree(folders);
    expect(tree.map((node) => node.folder.id)).toEqual(["other", "root"]);
    expect(tree[1].children[0].folder.id).toBe("child");
    expect(tree[1].children[0].children[0].depth).toBe(3);
    expect(flattenFolderTree(folders).map((node) => node.folder.id)).toEqual([
      "other",
      "root",
      "child",
      "grandchild"
    ]);
    expect(folderDescendantIds(folders, "root")).toEqual(new Set(["child", "grandchild"]));
  });
});
