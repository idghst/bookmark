import type { BookmarkFormData, BookmarkItem, Folder, FolderFormData, PositionUpdate, Section } from "@/app/lib/bookmarks/types";
import { findSectionByName } from "@/app/lib/bookmarks/sections";
import {
  createSupabaseRestHeaders,
  getSupabaseServerConfig
} from "@/app/lib/supabase/server-config";

type BookmarkRow = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  description: string | null;
  is_favorite: boolean | null;
  created_at: string;
  updated_at: string | null;
  folder_id: string | null;
  section_id: string | null;
  position: number | null;
};

type FolderRow = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  position: number | null;
};

type SectionRow = {
  id: string;
  user_id: string;
  name: string;
  folder_id: string;
  position: number | null;
};

const TABLES = {
  bookmarks: "items",
  folders: "folders",
  sections: "sections"
} as const;
const BOOKMARK_SCHEMA = "bookmark";
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

function getBookmarkSupabaseConfig() {
  const config = getSupabaseServerConfig();
  if (!config) {
    throw new StoreError(
      "BOOKMARK_SUPABASE_URL and BOOKMARK_SUPABASE_SECRET_KEY are required.",
      500
    );
  }
  return config;
}

async function supabaseRequest<T>(
  table: string,
  {
    method = "GET",
    query,
    body,
    prefer
  }: {
    method?: string;
    query?: Record<string, string>;
    body?: unknown;
    prefer?: string;
  } = {}
): Promise<T> {
  const config = getBookmarkSupabaseConfig();
  const endpoint = new URL(`${config.url}/rest/v1/${table}`);
  Object.entries(query ?? {}).forEach(([key, value]) => endpoint.searchParams.set(key, value));

  const requestHeaders = createSupabaseRestHeaders(config, {
    schema: BOOKMARK_SCHEMA,
    write: !["GET", "HEAD"].includes(method),
    prefer
  });
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");

  const response = await fetch(endpoint, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) throw new StoreError(await readErrorMessage(response), response.status);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string; details?: string; hint?: string };
    return payload.message ?? payload.details ?? payload.hint ?? response.statusText;
  } catch {
    return response.statusText || "Supabase REST request failed.";
  }
}

async function getBookmarkUserId() {
  const configured = process.env.BOOKMARK_USER_ID;
  if (!configured) throw new StoreError("BOOKMARK_USER_ID is required.", 500);
  return configured;
}

async function nextPosition(table: string, userId: string) {
  const rows = await supabaseRequest<Array<{ position: number | null }>>(table, {
    query: { select: "position", user_id: `eq.${userId}`, order: "position.desc", limit: "1" }
  });
  return (rows[0]?.position ?? -1) + 1;
}

function one<T>(rows: T[], label: string) {
  const row = rows[0];
  if (!row) throw new StoreError(`${label} not found.`, 404);
  return row;
}

function invalid(message: string): never {
  throw new StoreError(message, 400);
}

function record(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${label} body is invalid.`);
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) invalid(`${label} must be a non-empty string.`);
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

function assertAllowedFields(data: Record<string, unknown>, allowed: Set<string>, label: string) {
  if (Object.keys(data).some((key) => !allowed.has(key))) invalid(`${label} body contains unsupported fields.`);
}

function validateBookmarkCreate(value: unknown): BookmarkFormData {
  const data = record(value, "Bookmark");
  assertAllowedFields(data, BOOKMARK_FIELDS, "Bookmark");
  if (typeof data.isFavorite !== "boolean") invalid("Bookmark isFavorite must be boolean.");
  if (!Object.hasOwn(data, "folderId") || (data.folderId !== null && typeof data.folderId !== "string")) {
    invalid("Bookmark folderId must be a string or null.");
  }
  if (!Object.hasOwn(data, "sectionId") || (data.sectionId !== null && typeof data.sectionId !== "string")) {
    invalid("Bookmark sectionId must be a string or null.");
  }
  if (data.description !== undefined && data.description !== null && typeof data.description !== "string") {
    invalid("Bookmark description must be a string or null.");
  }

  return {
    title: nonEmptyString(data.title, "Bookmark title"),
    url: normalizeBookmarkUrl(data.url),
    description: data.description as string | null | undefined,
    isFavorite: data.isFavorite,
    folderId: data.folderId === null ? null : nonEmptyString(data.folderId, "Bookmark folderId"),
    sectionId: data.sectionId === null ? null : nonEmptyString(data.sectionId, "Bookmark sectionId")
  };
}

function validateBookmarkPatch(value: unknown): Partial<BookmarkFormData> {
  const data = record(value, "Bookmark");
  assertAllowedFields(data, BOOKMARK_FIELDS, "Bookmark");
  if (!Object.keys(data).length) invalid("Bookmark PATCH body must not be empty.");
  const result: Partial<BookmarkFormData> = {};

  if (Object.hasOwn(data, "title")) result.title = nonEmptyString(data.title, "Bookmark title");
  if (Object.hasOwn(data, "url")) result.url = normalizeBookmarkUrl(data.url);
  if (Object.hasOwn(data, "description")) {
    if (data.description !== null && typeof data.description !== "string") {
      invalid("Bookmark description must be a string or null.");
    }
    result.description = data.description as string | null;
  }
  if (Object.hasOwn(data, "isFavorite")) {
    if (typeof data.isFavorite !== "boolean") invalid("Bookmark isFavorite must be boolean.");
    result.isFavorite = data.isFavorite;
  }
  if (Object.hasOwn(data, "folderId")) {
    if (data.folderId !== null && typeof data.folderId !== "string") {
      invalid("Bookmark folderId must be a string or null.");
    }
    result.folderId = data.folderId === null ? null : nonEmptyString(data.folderId, "Bookmark folderId");
  }
  if (Object.hasOwn(data, "sectionId")) {
    if (data.sectionId !== null && typeof data.sectionId !== "string") {
      invalid("Bookmark sectionId must be a string or null.");
    }
    result.sectionId = data.sectionId === null ? null : nonEmptyString(data.sectionId, "Bookmark sectionId");
  }
  return result;
}

function validateFolderCreate(value: unknown): FolderFormData {
  const data = record(value, "Folder");
  assertAllowedFields(data, FOLDER_FIELDS, "Folder");
  if (data.color !== undefined && data.color !== null && typeof data.color !== "string") {
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
  if (Object.hasOwn(data, "name")) result.name = nonEmptyString(data.name, "Folder name");
  if (Object.hasOwn(data, "color")) {
    if (data.color !== null && typeof data.color !== "string") invalid("Folder color must be a string or null.");
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

async function ownedRow<T>(table: string, id: string, userId: string, label: string) {
  const rows = await supabaseRequest<T[]>(table, {
    query: { select: "*", id: `eq.${id}`, user_id: `eq.${userId}`, limit: "1" }
  });
  const row = rows[0];
  if (!row) invalid(`${label} does not belong to the configured user.`);
  return row;
}

async function validateBookmarkReferences(folderId: string | null, sectionId: string | null, userId: string) {
  if (folderId) await ownedRow<FolderRow>(TABLES.folders, folderId, userId, "Folder");
  if (!sectionId) return;
  const section = await ownedRow<SectionRow>(TABLES.sections, sectionId, userId, "Section");
  if (!folderId || section.folder_id !== folderId) invalid("Section must belong to the bookmark folder.");
}

async function reorderOwnedRows(
  table: string,
  items: PositionUpdate[],
  userId: string,
  updatedAt = false
) {
  if (!items.length) return;
  const rows = await supabaseRequest<Array<{ id: string; position: number | null }>>(table, {
    query: { select: "id,position", user_id: `eq.${userId}` }
  });
  const originalById = new Map(rows.map((row) => [row.id, row.position ?? 0]));
  if (items.some(({ id }) => !originalById.has(id))) {
    invalid("Reorder item does not belong to the configured user.");
  }

  try {
    for (const item of items) {
      await supabaseRequest<void>(table, {
        method: "PATCH",
        prefer: "return=minimal",
        query: { id: `eq.${item.id}`, user_id: `eq.${userId}` },
        body: {
          position: item.position,
          ...(updatedAt ? { updated_at: new Date().toISOString() } : {})
        }
      });
    }
  } catch (error) {
    await Promise.allSettled(
      items.map((item) =>
        supabaseRequest<void>(table, {
          method: "PATCH",
          prefer: "return=minimal",
          query: { id: `eq.${item.id}`, user_id: `eq.${userId}` },
          body: {
            position: originalById.get(item.id),
            ...(updatedAt ? { updated_at: new Date().toISOString() } : {})
          }
        })
      )
    );
    throw error;
  }
}

function mapBookmark(row: BookmarkRow): BookmarkItem {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    description: row.description,
    isFavorite: Boolean(row.is_favorite),
    folderId: row.folder_id,
    sectionId: row.section_id,
    position: row.position ?? 0
  };
}

function mapFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    position: row.position ?? 0
  };
}

function mapSection(row: SectionRow): Section {
  return {
    id: row.id,
    name: row.name,
    folderId: row.folder_id,
    position: row.position ?? 0
  };
}

export const bookmarkStore = {
  async listBookmarks() {
    const userId = await getBookmarkUserId();
    const rows = await supabaseRequest<BookmarkRow[]>(TABLES.bookmarks, {
      query: { select: "*", user_id: `eq.${userId}`, order: "position.asc" }
    });
    return rows.map(mapBookmark);
  },

  async createBookmark(value: unknown) {
    const data = validateBookmarkCreate(value);
    const userId = await getBookmarkUserId();
    await validateBookmarkReferences(data.folderId, data.sectionId, userId);
    const rows = await supabaseRequest<BookmarkRow[]>(TABLES.bookmarks, {
      method: "POST",
      prefer: "return=representation",
      body: {
        title: data.title,
        url: data.url,
        description: data.description ?? "",
        is_favorite: data.isFavorite,
        folder_id: data.folderId,
        section_id: data.sectionId,
        user_id: userId,
        position: await nextPosition(TABLES.bookmarks, userId)
      }
    });
    return mapBookmark(one(rows, "Bookmark"));
  },

  async updateBookmark(id: string, value: unknown) {
    const data = validateBookmarkPatch(value);
    const userId = await getBookmarkUserId();
    if (data.folderId !== undefined || data.sectionId !== undefined) {
      const current = await ownedRow<BookmarkRow>(TABLES.bookmarks, id, userId, "Bookmark");
      await validateBookmarkReferences(
        data.folderId === undefined ? current.folder_id : data.folderId,
        data.sectionId === undefined ? current.section_id : data.sectionId,
        userId
      );
    }
    const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) body.title = data.title;
    if (data.url !== undefined) body.url = data.url;
    if (data.description !== undefined) body.description = data.description;
    if (data.isFavorite !== undefined) body.is_favorite = data.isFavorite;
    if (data.folderId !== undefined) body.folder_id = data.folderId;
    if (data.sectionId !== undefined) body.section_id = data.sectionId;

    const rows = await supabaseRequest<BookmarkRow[]>(TABLES.bookmarks, {
      method: "PATCH",
      prefer: "return=representation",
      query: { id: `eq.${id}`, user_id: `eq.${userId}` },
      body
    });
    return mapBookmark(one(rows, "Bookmark"));
  },

  async deleteBookmark(id: string) {
    const userId = await getBookmarkUserId();
    await supabaseRequest<void>(TABLES.bookmarks, {
      method: "DELETE",
      prefer: "return=minimal",
      query: { id: `eq.${id}`, user_id: `eq.${userId}` }
    });
  },

  async reorderBookmarks(items: unknown) {
    const validated = validatePositionUpdates(items);
    const userId = await getBookmarkUserId();
    await reorderOwnedRows(TABLES.bookmarks, validated, userId, true);
  },

  async listFolders() {
    const userId = await getBookmarkUserId();
    const rows = await supabaseRequest<FolderRow[]>(TABLES.folders, {
      query: { select: "*", user_id: `eq.${userId}`, order: "position.asc" }
    });
    return rows.map(mapFolder);
  },

  async createFolder(value: unknown) {
    const data = validateFolderCreate(value);
    const userId = await getBookmarkUserId();
    const rows = await supabaseRequest<FolderRow[]>(TABLES.folders, {
      method: "POST",
      prefer: "return=representation",
      body: {
        name: data.name,
        color: data.color ?? null,
        user_id: userId,
        position: await nextPosition(TABLES.folders, userId)
      }
    });
    return mapFolder(one(rows, "Folder"));
  },

  async updateFolder(id: string, value: unknown) {
    const data = validateFolderPatch(value);
    const userId = await getBookmarkUserId();
    const rows = await supabaseRequest<FolderRow[]>(TABLES.folders, {
      method: "PATCH",
      prefer: "return=representation",
      query: { id: `eq.${id}`, user_id: `eq.${userId}` },
      body: data
    });
    return mapFolder(one(rows, "Folder"));
  },

  async deleteFolder(id: string) {
    const userId = await getBookmarkUserId();
    await supabaseRequest<void>(TABLES.folders, {
      method: "DELETE",
      prefer: "return=minimal",
      query: { id: `eq.${id}`, user_id: `eq.${userId}` }
    });
  },

  async reorderFolders(items: unknown) {
    const validated = validatePositionUpdates(items);
    const userId = await getBookmarkUserId();
    await reorderOwnedRows(TABLES.folders, validated, userId);
  },

  async listSections() {
    const userId = await getBookmarkUserId();
    const rows = await supabaseRequest<SectionRow[]>(TABLES.sections, {
      query: { select: "*", user_id: `eq.${userId}`, order: "position.asc" }
    });
    return rows.map(mapSection);
  },

  async createSection(folderIdValue: unknown, nameValue: unknown) {
    const folderId = nonEmptyString(folderIdValue, "Section folderId");
    const name = nonEmptyString(nameValue, "Section name");
    const userId = await getBookmarkUserId();
    await ownedRow<FolderRow>(TABLES.folders, folderId, userId, "Folder");
    const existingRows = await supabaseRequest<SectionRow[]>(TABLES.sections, {
      query: { select: "*", user_id: `eq.${userId}`, folder_id: `eq.${folderId}` }
    });
    const existing = findSectionByName(existingRows.map(mapSection), folderId, name);
    if (existing) return existing;

    const rows = await supabaseRequest<SectionRow[]>(TABLES.sections, {
      method: "POST",
      prefer: "return=representation",
      body: {
        name: name.trim(),
        folder_id: folderId,
        user_id: userId,
        position: await nextPosition(TABLES.sections, userId)
      }
    });
    return mapSection(one(rows, "Section"));
  },

  async deleteSection(id: string) {
    const userId = await getBookmarkUserId();
    await supabaseRequest<void>(TABLES.bookmarks, {
      method: "PATCH",
      prefer: "return=minimal",
      query: { section_id: `eq.${id}`, user_id: `eq.${userId}` },
      body: { section_id: null, updated_at: new Date().toISOString() }
    });
    await supabaseRequest<void>(TABLES.sections, {
      method: "DELETE",
      prefer: "return=minimal",
      query: { id: `eq.${id}`, user_id: `eq.${userId}` }
    });
  },

  async reorderSections(items: unknown) {
    const validated = validatePositionUpdates(items);
    const userId = await getBookmarkUserId();
    await reorderOwnedRows(TABLES.sections, validated, userId);
  }
};
