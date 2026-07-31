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
  position: number;
};

export type Section = {
  id: string;
  name: string;
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
};

export type SectionFormData = {
  name: string;
};

export type PositionUpdate = {
  id: string;
  position: number;
};
