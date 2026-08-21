import { restRequest } from "@/app/lib/bookmarks/rest";
import { findSectionByName } from "@/app/lib/bookmarks/sections";
import type { BookmarkItem, Folder, FolderSection, Section } from "@/app/lib/bookmarks/types";
import {
  StoreError,
  invalid,
  nonEmptyString,
  validateBookmarkCreate,
  validateBookmarkPatch,
  validateFolderCreate,
  validateFolderPatch,
  validateFolderSectionCreate,
  validateFolderSectionPatch,
  validatePositionUpdates,
  validateSectionPatch
} from "@/app/lib/bookmarks/validation";

export { StoreError };

export const bookmarkStore = {
  async listBookmarks() {
    return restRequest<BookmarkItem[]>("bookmarks");
  },

  async createBookmark(value: unknown) {
    return restRequest<BookmarkItem>("bookmarks", {
      method: "POST",
      body: validateBookmarkCreate(value)
    });
  },

  async updateBookmark(id: string, value: unknown) {
    return restRequest<BookmarkItem>(`bookmarks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: validateBookmarkPatch(value)
    });
  },

  async deleteBookmark(id: string) {
    await restRequest<void>(`bookmarks/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  async reorderBookmarks(value: unknown) {
    await restRequest<void>("bookmarks/reorder", {
      method: "POST",
      body: validatePositionUpdates(value)
    });
  },

  async listFolders() {
    return restRequest<Folder[]>("folders");
  },

  async createFolder(value: unknown) {
    return restRequest<Folder>("folders", {
      method: "POST",
      body: validateFolderCreate(value)
    });
  },

  async updateFolder(id: string, value: unknown) {
    return restRequest<Folder>(`folders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: validateFolderPatch(value)
    });
  },

  async deleteFolder(id: string, destinationFolderId?: string) {
    const destination = destinationFolderId === undefined
      ? null
      : nonEmptyString(destinationFolderId, "Destination folder id");
    const query = destination === null
      ? ""
      : `?destination_folder_id=${encodeURIComponent(destination)}`;
    await restRequest<void>(`folders/${encodeURIComponent(id)}${query}`, {
      method: "DELETE"
    });
  },

  async reorderFolders(value: unknown) {
    await restRequest<void>("folders/reorder", {
      method: "POST",
      body: validatePositionUpdates(value)
    });
  },

  async listSections() {
    return restRequest<Section[]>("sections");
  },

  async createSection(nameValue: unknown, colorValue?: unknown) {
    const name = nonEmptyString(nameValue, "Section name");
    if (colorValue !== undefined && colorValue !== null && typeof colorValue !== "string") {
      invalid("Section color must be a string or null.");
    }
    const color = colorValue as string | null | undefined;
    const existing = findSectionByName(await bookmarkStore.listSections(), name);
    if (existing) return existing;
    return restRequest<Section>("sections", {
      method: "POST",
      body: { name, color }
    });
  },

  async updateSection(id: string, value: unknown) {
    return restRequest<Section>(`sections/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: validateSectionPatch(value)
    });
  },

  async deleteSection(id: string) {
    await restRequest<void>(`sections/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  async reorderSections(value: unknown) {
    await restRequest<void>("sections/reorder", {
      method: "POST",
      body: validatePositionUpdates(value)
    });
  },

  async listFolderSections() {
    return restRequest<FolderSection[]>("folder-sections");
  },

  async createFolderSection(value: unknown) {
    return restRequest<FolderSection>("folder-sections", {
      method: "POST",
      body: validateFolderSectionCreate(value)
    });
  },

  async updateFolderSection(id: string, value: unknown) {
    return restRequest<FolderSection>(`folder-sections/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: validateFolderSectionPatch(value)
    });
  },

  async deleteFolderSection(id: string) {
    await restRequest<void>(`folder-sections/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  async reorderFolderSections(value: unknown) {
    await restRequest<void>("folder-sections/reorder", {
      method: "POST",
      body: validatePositionUpdates(value)
    });
  }
};
