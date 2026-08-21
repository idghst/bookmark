export type BookmarkItem = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  isFavorite: boolean;
  folderId: string | null;
  folderSectionId?: string | null;
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
  color?: string | null;
  position: number;
};

export type FolderSection = {
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
  folderSectionId?: string | null;
};

export type FolderSectionFormData = {
  name: string;
  color?: string | null;
  folderId: string;
};

export type FolderFormData = {
  name: string;
  color?: string | null;
  sectionId?: string | null;
};

export type SectionFormData = {
  name: string;
  color?: string | null;
};

export type PositionUpdate = {
  id: string;
  position: number;
};
