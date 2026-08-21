export type BookmarkItem = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  isFavorite: boolean;
  folderId: string | null;
  position: number;
};

export type Folder = {
  id: string;
  name: string;
  color: string | null;
  sectionId?: string | null;
  position: number;
};

export type Section = {
  id: string;
  name: string;
  color: string | null;
  position: number;
};

export type BookmarkCreateInput = {
  title: string;
  url: string;
  description: string | null;
  isFavorite: boolean;
  folderId: string | null;
};

export type BookmarkPatch = Partial<BookmarkCreateInput>;
