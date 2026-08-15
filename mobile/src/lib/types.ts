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
  parentId: string | null;
  position: number;
};

export type BookmarkCreateInput = {
  title: string;
  url: string;
  description: string | null;
  isFavorite: boolean;
  folderId: string | null;
  sectionId: string | null;
};

export type BookmarkPatch = Partial<Omit<BookmarkCreateInput, "sectionId">> & {
  sectionId?: string | null;
};
