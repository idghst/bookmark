export type BookmarkItem = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  isFavorite: boolean;
  folderId: string | null;
  sectionId: string | null;
  position: number;
};

export type Folder = {
  id: string;
  name: string;
  color: string | null;
  /**
   * `null`이면 루트 폴더입니다. API/DB의 `parent_id`는 프론트 경계에서
   * camelCase로 정규화합니다. 구형 캐시·API 응답과의 호환을 위해 optional로 둡니다.
   */
  parentId?: string | null;
  position: number;
};

/** GET /api/folders가 트리 응답을 제공할 때의 노드 형태입니다. */
export type FolderTreeItem = Folder & {
  children?: FolderTreeItem[];
};

export type Section = {
  id: string;
  name: string;
  color?: string | null;
  folderId: string;
  position: number;
};

export type BookmarkFormData = {
  title: string;
  url: string;
  description?: string | null;
  isFavorite: boolean;
  folderId: string | null;
  sectionId: string | null;
};

export type FolderFormData = {
  name: string;
  color?: string | null;
  parentId?: string | null;
};

export type SectionFormData = {
  name: string;
  color?: string | null;
  folderId?: string;
};

export type PositionUpdate = {
  id: string;
  position: number;
};
