import { findSectionByName } from "@/app/lib/bookmarks/sections";
import type {
  BookmarkFormData,
  BookmarkItem,
  Folder,
  FolderFormData,
  PositionUpdate,
  Section
} from "@/app/lib/bookmarks/types";

const BOOKMARK_FIELDS = new Set([
  "title",
  "url",
  "description",
  "isFavorite",
  "folderId",
  "sectionId"
]);
const FOLDER_FIELDS = new Set(["name", "color"]);

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
  return {
    name: nonEmptyString(data.name, "Folder name"),
    color: data.color as string | null | undefined
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

function getFastApiConfig() {
  const rawUrl = process.env.BOOKMARK_API_URL?.trim();
  const apiKey = process.env.BOOKMARK_API_KEY?.trim();
  if (!rawUrl || !apiKey) {
    throw new StoreError(
      "BOOKMARK_API_URL and BOOKMARK_API_KEY are required.",
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
    return { url: url.toString().replace(/\/$/, ""), apiKey };
  } catch {
    throw new StoreError("BOOKMARK_API_URL must be a valid HTTP(S) URL.", 500);
  }
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as {
      message?: string;
      detail?: string | Array<{ msg?: string }>;
    };
    if (payload.message) return payload.message;
    if (typeof payload.detail === "string") return payload.detail;
    if (Array.isArray(payload.detail)) {
      return payload.detail.find((item) => item.msg)?.msg ?? "FastAPI request failed.";
    }
  } catch {
    // Use the stable fallback below.
  }
  return response.statusText || "FastAPI request failed.";
}

async function fastApiRequest<T>(
  path: string,
  {
    method = "GET",
    body
  }: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const config = getFastApiConfig();
  const endpoint = new URL(path.replace(/^\/+/, ""), `${config.url}/`);
  const headers = new Headers({
    Accept: "application/json",
    "X-Bookmark-Key": config.apiKey
  });
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(endpoint, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new StoreError(await readErrorMessage(response), response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const bookmarkStore = {
  listBookmarks: () => fastApiRequest<BookmarkItem[]>("/api/bookmarks"),

  async createBookmark(value: unknown) {
    return fastApiRequest<BookmarkItem>("/api/bookmarks", {
      method: "POST",
      body: validateBookmarkCreate(value)
    });
  },

  async updateBookmark(id: string, value: unknown) {
    return fastApiRequest<BookmarkItem>(`/api/bookmarks/${id}`, {
      method: "PATCH",
      body: validateBookmarkPatch(value)
    });
  },

  deleteBookmark: (id: string) =>
    fastApiRequest<void>(`/api/bookmarks/${id}`, { method: "DELETE" }),

  async reorderBookmarks(value: unknown) {
    return fastApiRequest<void>("/api/bookmarks/reorder", {
      method: "POST",
      body: validatePositionUpdates(value)
    });
  },

  listFolders: () => fastApiRequest<Folder[]>("/api/folders"),

  async createFolder(value: unknown) {
    return fastApiRequest<Folder>("/api/folders", {
      method: "POST",
      body: validateFolderCreate(value)
    });
  },

  async updateFolder(id: string, value: unknown) {
    return fastApiRequest<Folder>(`/api/folders/${id}`, {
      method: "PATCH",
      body: validateFolderPatch(value)
    });
  },

  deleteFolder: (id: string) =>
    fastApiRequest<void>(`/api/folders/${id}`, { method: "DELETE" }),

  async reorderFolders(value: unknown) {
    return fastApiRequest<void>("/api/folders/reorder", {
      method: "POST",
      body: validatePositionUpdates(value)
    });
  },

  listSections: () => fastApiRequest<Section[]>("/api/sections"),

  async createSection(folderIdValue: unknown, nameValue: unknown) {
    const folderId = nonEmptyString(folderIdValue, "Section folderId");
    const name = nonEmptyString(nameValue, "Section name");
    const existing = findSectionByName(
      await fastApiRequest<Section[]>("/api/sections"),
      folderId,
      name
    );
    if (existing) return existing;
    return fastApiRequest<Section>("/api/sections", {
      method: "POST",
      body: { folderId, name }
    });
  },

  deleteSection: (id: string) =>
    fastApiRequest<void>(`/api/sections/${id}`, { method: "DELETE" }),

  async reorderSections(value: unknown) {
    return fastApiRequest<void>("/api/sections/reorder", {
      method: "POST",
      body: validatePositionUpdates(value)
    });
  }
};
