import { graphqlRequest, BOOKMARK_SELECTION, FOLDER_SELECTION, SECTION_SELECTION } from "@/app/lib/bookmarks/graphql";
import { findSectionByName } from "@/app/lib/bookmarks/sections";
import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";
import {
  StoreError,
  invalid,
  nonEmptyString,
  validateBookmarkCreate,
  validateBookmarkPatch,
  validateFolderCreate,
  validateFolderPatch,
  validatePositionUpdates,
  validateSectionPatch
} from "@/app/lib/bookmarks/validation";

export { StoreError };

export const bookmarkStore = {
  async listBookmarks() {
    const data = await graphqlRequest<{ bookmarks: BookmarkItem[] }>(`
      query ListBookmarks {
        bookmarks { ${BOOKMARK_SELECTION} }
      }
    `);
    return data.bookmarks;
  },

  async createBookmark(value: unknown) {
    const data = await graphqlRequest<{ createBookmark: BookmarkItem }>(
      `mutation CreateBookmark($input: BookmarkCreateInput!) {
        createBookmark(input: $input) { ${BOOKMARK_SELECTION} }
      }`,
      { input: validateBookmarkCreate(value) }
    );
    return data.createBookmark;
  },

  async updateBookmark(id: string, value: unknown) {
    const data = await graphqlRequest<{ updateBookmark: BookmarkItem }>(
      `mutation UpdateBookmark($id: ID!, $input: BookmarkUpdateInput!) {
        updateBookmark(id: $id, input: $input) { ${BOOKMARK_SELECTION} }
      }`,
      { id, input: validateBookmarkPatch(value) }
    );
    return data.updateBookmark;
  },

  async deleteBookmark(id: string) {
    await graphqlRequest<{ deleteBookmark: boolean }>(
      `mutation DeleteBookmark($id: ID!) {
        deleteBookmark(id: $id)
      }`,
      { id }
    );
  },

  async reorderBookmarks(value: unknown) {
    await graphqlRequest<{ reorderBookmarks: boolean }>(
      `mutation ReorderBookmarks($input: [PositionInput!]!) {
        reorderBookmarks(input: $input)
      }`,
      { input: validatePositionUpdates(value) }
    );
  },

  async listFolders() {
    const data = await graphqlRequest<{ folders: Folder[] }>(`
      query ListFolders {
        folders { ${FOLDER_SELECTION} }
      }
    `);
    return data.folders;
  },

  async createFolder(value: unknown) {
    const data = await graphqlRequest<{ createFolder: Folder }>(
      `mutation CreateFolder($input: FolderCreateInput!) {
        createFolder(input: $input) { ${FOLDER_SELECTION} }
      }`,
      { input: validateFolderCreate(value) }
    );
    return data.createFolder;
  },

  async updateFolder(id: string, value: unknown) {
    const data = await graphqlRequest<{ updateFolder: Folder }>(
      `mutation UpdateFolder($id: ID!, $input: FolderUpdateInput!) {
        updateFolder(id: $id, input: $input) { ${FOLDER_SELECTION} }
      }`,
      { id, input: validateFolderPatch(value) }
    );
    return data.updateFolder;
  },

  async deleteFolder(id: string, destinationFolderId?: string) {
    const destination = destinationFolderId === undefined
      ? null
      : nonEmptyString(destinationFolderId, "Destination folder id");
    await graphqlRequest<{ deleteFolder: boolean }>(
      `mutation DeleteFolder($id: ID!, $destinationFolderId: ID) {
        deleteFolder(id: $id, destinationFolderId: $destinationFolderId)
      }`,
      { id, destinationFolderId: destination }
    );
  },

  async reorderFolders(value: unknown) {
    await graphqlRequest<{ reorderFolders: boolean }>(
      `mutation ReorderFolders($input: [PositionInput!]!) {
        reorderFolders(input: $input)
      }`,
      { input: validatePositionUpdates(value) }
    );
  },

  async listSections() {
    const data = await graphqlRequest<{ sections: Section[] }>(`
      query ListSections {
        sections { ${SECTION_SELECTION} }
      }
    `);
    return data.sections;
  },

  async createSection(folderIdValue: unknown, nameValue: unknown, colorValue?: unknown) {
    const folderId = nonEmptyString(folderIdValue, "Section folderId");
    const name = nonEmptyString(nameValue, "Section name");
    if (colorValue !== undefined && colorValue !== null && typeof colorValue !== "string") {
      invalid("Section color must be a string or null.");
    }
    const color = colorValue as string | null | undefined;
    const existing = findSectionByName(
      await bookmarkStore.listSections(),
      folderId,
      name
    );
    if (existing) return existing;
    const data = await graphqlRequest<{ createSection: Section }>(
      `mutation CreateSection($input: SectionCreateInput!) {
        createSection(input: $input) { ${SECTION_SELECTION} }
      }`,
      { input: { folderId, name, color } }
    );
    return data.createSection;
  },

  async updateSection(id: string, value: unknown) {
    const data = await graphqlRequest<{ updateSection: Section }>(
      `mutation UpdateSection($id: ID!, $input: SectionUpdateInput!) {
        updateSection(id: $id, input: $input) { ${SECTION_SELECTION} }
      }`,
      { id, input: validateSectionPatch(value) }
    );
    return data.updateSection;
  },

  async deleteSection(id: string) {
    await graphqlRequest<{ deleteSection: boolean }>(
      `mutation DeleteSection($id: ID!) {
        deleteSection(id: $id)
      }`,
      { id }
    );
  },

  async reorderSections(value: unknown) {
    await graphqlRequest<{ reorderSections: boolean }>(
      `mutation ReorderSections($input: [PositionInput!]!) {
        reorderSections(input: $input)
      }`,
      { input: validatePositionUpdates(value) }
    );
  }
};
