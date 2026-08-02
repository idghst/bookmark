import type { Folder, FolderTreeItem } from "@/app/lib/bookmarks/types";

export type FolderTreeNode = {
  folder: Folder;
  depth: number;
  children: FolderTreeNode[];
};

type FolderApiItem = FolderTreeItem & {
  parent_id?: string | null;
};

export function folderParentId(folder: Pick<Folder, "parentId">) {
  return folder.parentId ?? null;
}

function folderSort(a: Folder, b: Folder) {
  return a.position - b.position || a.name.localeCompare(b.name, "ko");
}

/** Sibling마다 position을 0부터 다시 부여한다. */
export function normalizeFolderPositions(folders: Folder[]) {
  const byParent = new Map<string | null, Folder[]>();
  folders.forEach((folder) => {
    const parentId = folderParentId(folder);
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), folder]);
  });

  const positions = new Map<string, number>();
  byParent.forEach((siblings) => {
    siblings.sort(folderSort).forEach((folder, position) => positions.set(folder.id, position));
  });

  return folders.map((folder) => ({
    ...folder,
    parentId: folderParentId(folder),
    position: positions.get(folder.id) ?? folder.position
  }));
}

/**
 * flat (`parentId`/`parent_id`)과 nested (`children`) 폴더 API 응답을 모두
 * 페이지 상태용 flat 배열로 바꾼다. 중복 노드는 첫 번째 노드를 우선한다.
 */
export function flattenFolderResponse(value: FolderApiItem[]) {
  const folders: Folder[] = [];
  const seen = new Set<string>();

  function visit(item: FolderApiItem, inheritedParentId: string | null) {
    if (!item || typeof item.id !== "string" || !item.id || seen.has(item.id)) return;
    seen.add(item.id);

    const explicitParentId =
      typeof item.parentId === "string"
        ? item.parentId
        : typeof item.parent_id === "string"
          ? item.parent_id
          : item.parentId === null || item.parent_id === null
            ? null
            : inheritedParentId;
    folders.push({
      id: item.id,
      name: item.name,
      color: item.color,
      parentId: explicitParentId,
      position: item.position
    });
    item.children?.forEach((child) => visit(child as FolderApiItem, item.id));
  }

  value.forEach((item) => visit(item, null));
  return normalizeFolderPositions(folders);
}

/** flat folder 목록을 화면용 트리로 만든다. 고아/자기 자신 참조는 루트로 표시한다. */
export function buildFolderTree(folders: Folder[]) {
  const normalized = normalizeFolderPositions(folders);
  const ids = new Set(normalized.map((folder) => folder.id));
  const children = new Map<string | null, Folder[]>();

  normalized.forEach((folder) => {
    const requestedParentId = folderParentId(folder);
    const parentId = requestedParentId && requestedParentId !== folder.id && ids.has(requestedParentId)
      ? requestedParentId
      : null;
    children.set(parentId, [...(children.get(parentId) ?? []), { ...folder, parentId }]);
  });
  children.forEach((siblings) => siblings.sort(folderSort));

  const rendered = new Set<string>();
  function makeNode(folder: Folder, depth: number, ancestors: Set<string>): FolderTreeNode {
    rendered.add(folder.id);
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(folder.id);
    const nested = (children.get(folder.id) ?? [])
      .filter((child) => !nextAncestors.has(child.id))
      .map((child) => makeNode(child, depth + 1, nextAncestors));
    return { folder, depth, children: nested };
  }

  const roots = (children.get(null) ?? []).map((folder) => makeNode(folder, 1, new Set()));

  // 비정상 순환 참조가 있더라도 폴더를 숨기지 않고 루트에 표시한다.
  normalized
    .filter((folder) => !rendered.has(folder.id))
    .sort(folderSort)
    .forEach((folder) => roots.push(makeNode({ ...folder, parentId: null }, 1, new Set())));

  return roots;
}

export function folderDescendantIds(folders: Folder[], folderId: string) {
  const descendants = new Set<string>();
  const childrenByParent = new Map<string, string[]>();
  folders.forEach((folder) => {
    const parentId = folderParentId(folder);
    if (parentId) childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), folder.id]);
  });

  const visit = (parentId: string) => {
    (childrenByParent.get(parentId) ?? []).forEach((childId) => {
      if (descendants.has(childId)) return;
      descendants.add(childId);
      visit(childId);
    });
  };
  visit(folderId);
  return descendants;
}
