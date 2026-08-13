import { findSectionByName } from "@/app/lib/bookmarks/sections";
import type {
  BookmarkFormData,
  BookmarkItem,
  Folder,
  FolderFormData,
  PositionUpdate,
  Section,
  SectionFormData
} from "@/app/lib/bookmarks/types";

const BOOKMARK_FIELDS = new Set([
  "title",
  "url",
  "description",
  "isFavorite",
  "folderId",
  "sectionId"
]);
const FOLDER_FIELDS = new Set(["name", "color", "parentId"]);
const SECTION_FIELDS = new Set(["name", "color", "folderId"]);

export class StoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
    this.name = "StoreError";
  }
}

function invalid(message: string): never {
  throw new StoreError(message, 400);
}

function record(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(`${label} body is invalid.`);
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    invalid(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizeBookmarkUrl(value: unknown) {
  const raw = nonEmptyString(value, "Bookmark URL");
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) {
    invalid("Bookmark URL must use http or https.");
  }

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
      invalid("Bookmark URL must use http or https.");
    }
    return url.toString();
  } catch {
    return invalid("Bookmark URL is invalid.");
  }
}

function assertAllowedFields(
  data: Record<string, unknown>,
  allowed: Set<string>,
  label: string
) {
  if (Object.keys(data).some((key) => !allowed.has(key))) {
    invalid(`${label} body contains unsupported fields.`);
  }
}

function validateBookmarkCreate(value: unknown): BookmarkFormData {
  const data = record(value, "Bookmark");
  assertAllowedFields(data, BOOKMARK_FIELDS, "Bookmark");
  if (typeof data.isFavorite !== "boolean") {
    invalid("Bookmark isFavorite must be boolean.");
  }
  if (
    !Object.hasOwn(data, "folderId") ||
    (data.folderId !== null && typeof data.folderId !== "string")
  ) {
    invalid("Bookmark folderId must be a string or null.");
  }
  if (
    !Object.hasOwn(data, "sectionId") ||
    (data.sectionId !== null && typeof data.sectionId !== "string")
  ) {
    invalid("Bookmark sectionId must be a string or null.");
  }
  if (
    data.description !== undefined &&
    data.description !== null &&
    typeof data.description !== "string"
  ) {
    invalid("Bookmark description must be a string or null.");
  }

  return {
    title: nonEmptyString(data.title, "Bookmark title"),
    url: normalizeBookmarkUrl(data.url),
    description: data.description as string | null | undefined,
    isFavorite: data.isFavorite,
    folderId:
      data.folderId === null
        ? null
        : nonEmptyString(data.folderId, "Bookmark folderId"),
    sectionId:
      data.sectionId === null
        ? null
        : nonEmptyString(data.sectionId, "Bookmark sectionId")
  };
}

function validateBookmarkPatch(value: unknown): Partial<BookmarkFormData> {
  const data = record(value, "Bookmark");
  assertAllowedFields(data, BOOKMARK_FIELDS, "Bookmark");
  if (!Object.keys(data).length) invalid("Bookmark PATCH body must not be empty.");
  const result: Partial<BookmarkFormData> = {};

  if (Object.hasOwn(data, "title")) {
    result.title = nonEmptyString(data.title, "Bookmark title");
  }
  if (Object.hasOwn(data, "url")) result.url = normalizeBookmarkUrl(data.url);
  if (Object.hasOwn(data, "description")) {
    if (data.description !== null && typeof data.description !== "string") {
      invalid("Bookmark description must be a string or null.");
    }
    result.description = data.description as string | null;
  }
  if (Object.hasOwn(data, "isFavorite")) {
    if (typeof data.isFavorite !== "boolean") {
      invalid("Bookmark isFavorite must be boolean.");
    }
    result.isFavorite = data.isFavorite;
  }
  if (Object.hasOwn(data, "folderId")) {
    if (data.folderId !== null && typeof data.folderId !== "string") {
      invalid("Bookmark folderId must be a string or null.");
    }
    result.folderId =
      data.folderId === null
        ? null
        : nonEmptyString(data.folderId, "Bookmark folderId");
  }
  if (Object.hasOwn(data, "sectionId")) {
    if (data.sectionId !== null && typeof data.sectionId !== "string") {
      invalid("Bookmark sectionId must be a string or null.");
    }
    result.sectionId =
      data.sectionId === null
        ? null
        : nonEmptyString(data.sectionId, "Bookmark sectionId");
  }
  return result;
}

function validateFolderCreate(value: unknown): FolderFormData {
  const data = record(value, "Folder");
  assertAllowedFields(data, FOLDER_FIELDS, "Folder");
  if (
    data.color !== undefined &&
    data.color !== null &&
    typeof data.color !== "string"
  ) {
    invalid("Folder color must be a string or null.");
  }
  if (
    data.parentId !== undefined &&
    data.parentId !== null &&
    typeof data.parentId !== "string"
  ) {
    invalid("Folder parentId must be a string or null.");
  }
  return {
    name: nonEmptyString(data.name, "Folder name"),
    color: data.color as string | null | undefined,
    parentId:
      data.parentId === undefined || data.parentId === null
        ? data.parentId as null | undefined
        : nonEmptyString(data.parentId, "Folder parentId")
  };
}

function validateFolderPatch(value: unknown): Partial<FolderFormData> {
  const data = record(value, "Folder");
  assertAllowedFields(data, FOLDER_FIELDS, "Folder");
  if (!Object.keys(data).length) invalid("Folder PATCH body must not be empty.");
  const result: Partial<FolderFormData> = {};
  if (Object.hasOwn(data, "name")) {
    result.name = nonEmptyString(data.name, "Folder name");
  }
  if (Object.hasOwn(data, "color")) {
    if (data.color !== null && typeof data.color !== "string") {
      invalid("Folder color must be a string or null.");
    }
    result.color = data.color as string | null;
  }
  if (Object.hasOwn(data, "parentId")) {
    if (data.parentId !== null && typeof data.parentId !== "string") {
      invalid("Folder parentId must be a string or null.");
    }
    result.parentId =
      data.parentId === null
        ? null
        : nonEmptyString(data.parentId, "Folder parentId");
  }
  return result;
}

function validateSectionPatch(value: unknown): Partial<SectionFormData> {
  const data = record(value, "Section");
  assertAllowedFields(data, SECTION_FIELDS, "Section");
  if (!Object.keys(data).length) invalid("Section PATCH body must not be empty.");
  const result: Partial<SectionFormData> = {};
  if (Object.hasOwn(data, "name")) {
    result.name = nonEmptyString(data.name, "Section name");
  }
  if (Object.hasOwn(data, "color")) {
    if (data.color !== null && typeof data.color !== "string") {
      invalid("Section color must be a string or null.");
    }
    result.color = data.color as string | null;
  }
  if (Object.hasOwn(data, "folderId")) {
    result.folderId = nonEmptyString(data.folderId, "Section folderId");
  }
  return result;
}

function validatePositionUpdates(value: unknown): PositionUpdate[] {
  if (!Array.isArray(value)) invalid("Reorder body must be an array.");
  const ids = new Set<string>();
  return value.map((entry) => {
    const item = record(entry, "Reorder item");
    if (
      Object.keys(item).length !== 2 ||
      !Object.hasOwn(item, "id") ||
      !Object.hasOwn(item, "position")
    ) {
      invalid("Reorder items require only id and position.");
    }
    const id = nonEmptyString(item.id, "Reorder id");
    if (!Number.isInteger(item.position) || (item.position as number) < 0) {
      invalid("Reorder position must be a non-negative integer.");
    }
    if (ids.has(id)) invalid("Reorder ids must be unique.");
    ids.add(id);
    return { id, position: item.position as number };
  });
}

function getGraphqlConfig() {
  const rawGraphqlUrl = process.env.BOOKMARK_GRAPHQL_URL?.trim();
  const rawUrl = rawGraphqlUrl || process.env.BOOKMARK_API_URL?.trim();
  const apiKey = process.env.BOOKMARK_API_KEY?.trim();
  if (!rawUrl || !apiKey) {
    throw new StoreError(
      "BOOKMARK_GRAPHQL_URL and BOOKMARK_API_KEY are required.",
      500
    );
  }

  try {
    const url = new URL(rawUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      throw new Error();
    }
    if (!rawGraphqlUrl) {
      url.pathname = "/graphql";
      url.search = "";
      url.hash = "";
    }
    return { url: url.toString(), apiKey };
  } catch {
    throw new StoreError(
      "BOOKMARK_GRAPHQL_URL must be a valid HTTP(S) URL.",
      500
    );
  }
}

const GRAPHQL_ERROR_STATUS: Record<string, number> = {
  BAD_USER_INPUT: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409
};

type GraphqlPayload<T> = {
  data?: T | null;
  errors?: Array<{
    message?: string;
    extensions?: { code?: string };
  }>;
};

async function readGraphqlPayload<T>(response: Response) {
  try {
    return (await response.json()) as GraphqlPayload<T>;
  } catch {
    throw new StoreError(
      response.statusText || "GraphQL request failed.",
      response.ok ? 502 : response.status
    );
  }
}

async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const config = getGraphqlConfig();
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Bookmark-Key": config.apiKey
  });

  const response = await fetch(config.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });
  const payload = await readGraphqlPayload<T>(response);
  const error = payload.errors?.[0];
  if (error) {
    const code = error.extensions?.code ?? "";
    throw new StoreError(
      error.message || "GraphQL request failed.",
      GRAPHQL_ERROR_STATUS[code] ?? (response.ok ? 500 : response.status)
    );
  }
  if (!response.ok) {
    throw new StoreError(
      response.statusText || "GraphQL request failed.",
      response.status
    );
  }
  if (!payload.data) {
    throw new StoreError("GraphQL response is missing data.", 502);
  }
  return payload.data;
}

const BOOKMARK_SELECTION = `
  id title url description isFavorite folderId sectionId position
`;
const FOLDER_SELECTION = `id name color parentId position`;
const SECTION_SELECTION = `id name color folderId position`;

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
