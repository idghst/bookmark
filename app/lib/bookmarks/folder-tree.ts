import type { Folder } from "@/app/lib/bookmarks/types";

type FolderApiItem = Omit<Folder, "sectionId"> & {
  sectionId?: string | null;
  section_id?: string | null;
};

export function folderSectionId(folder: Pick<Folder, "sectionId">) {
  return folder.sectionId ?? null;
}

function folderSort(a: Folder, b: Folder) {
  return a.position - b.position || a.name.localeCompare(b.name, "ko");
}

/** 섹션마다 position을 0부터 다시 부여한다. */
export function normalizeFolderPositions(folders: Folder[]) {
  const bySection = new Map<string | null, Folder[]>();
  folders.forEach((folder) => {
    const sectionId = folderSectionId(folder);
    bySection.set(sectionId, [...(bySection.get(sectionId) ?? []), folder]);
  });

  const positions = new Map<string, number>();
  bySection.forEach((scoped) => {
    scoped.sort(folderSort).forEach((folder, position) => positions.set(folder.id, position));
  });

  return folders.map((folder) => ({
    ...folder,
    sectionId: folderSectionId(folder),
    position: positions.get(folder.id) ?? folder.position
  }));
}

/** flat API 응답의 section_id를 camelCase로 정규화한다. */
export function flattenFolderResponse(value: FolderApiItem[]) {
  return normalizeFolderPositions(
    value.flatMap((item) => {
      if (!item || typeof item.id !== "string" || !item.id) return [];
      return [{
      id: item.id,
      name: item.name,
      color: item.color,
      sectionId: item.sectionId ?? item.section_id ?? null,
      position: item.position
      }];
    })
  );
}
