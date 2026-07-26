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

export class StoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
    this.name = "StoreError";
  }
}

let userIdPromise: Promise<string> | null = null;

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

async function findUserIdIn(table: string) {
  const rows = await supabaseRequest<Array<{ user_id: string }>>(table, {
    query: { select: "user_id", order: "created_at.asc", limit: "1" }
  });
  return rows[0]?.user_id ?? null;
}

async function getBookmarkUserId() {
  if (!userIdPromise) {
    userIdPromise = (async () => {
      const configured = process.env.BOOKMARK_USER_ID;
      if (configured) return configured;

      const inferred =
        (await findUserIdIn(TABLES.bookmarks)) ??
        (await findUserIdIn(TABLES.folders)) ??
        (await findUserIdIn(TABLES.sections));

      if (!inferred) throw new StoreError("BOOKMARK_USER_ID is required when no existing bookmark rows identify a user.", 500);
      return inferred;
    })();
  }

  return userIdPromise;
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

  async createBookmark(data: BookmarkFormData) {
    const userId = await getBookmarkUserId();
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

  async updateBookmark(id: string, data: Partial<BookmarkFormData>) {
    const userId = await getBookmarkUserId();
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

  async reorderBookmarks(items: PositionUpdate[]) {
    const userId = await getBookmarkUserId();
    await Promise.all(
      items.map((item) =>
        supabaseRequest<void>(TABLES.bookmarks, {
          method: "PATCH",
          prefer: "return=minimal",
          query: { id: `eq.${item.id}`, user_id: `eq.${userId}` },
          body: { position: item.position, updated_at: new Date().toISOString() }
        })
      )
    );
  },

  async listFolders() {
    const userId = await getBookmarkUserId();
    const rows = await supabaseRequest<FolderRow[]>(TABLES.folders, {
      query: { select: "*", user_id: `eq.${userId}`, order: "position.asc" }
    });
    return rows.map(mapFolder);
  },

  async createFolder(data: FolderFormData) {
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

  async updateFolder(id: string, data: Partial<FolderFormData>) {
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

  async reorderFolders(items: PositionUpdate[]) {
    const userId = await getBookmarkUserId();
    await Promise.all(
      items.map((item) =>
        supabaseRequest<void>(TABLES.folders, {
          method: "PATCH",
          prefer: "return=minimal",
          query: { id: `eq.${item.id}`, user_id: `eq.${userId}` },
          body: { position: item.position }
        })
      )
    );
  },

  async listSections() {
    const userId = await getBookmarkUserId();
    const rows = await supabaseRequest<SectionRow[]>(TABLES.sections, {
      query: { select: "*", user_id: `eq.${userId}`, order: "position.asc" }
    });
    return rows.map(mapSection);
  },

  async createSection(folderId: string, name: string) {
    const userId = await getBookmarkUserId();
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

  async reorderSections(items: PositionUpdate[]) {
    const userId = await getBookmarkUserId();
    await Promise.all(
      items.map((item) =>
        supabaseRequest<void>(TABLES.sections, {
          method: "PATCH",
          prefer: "return=minimal",
          query: { id: `eq.${item.id}`, user_id: `eq.${userId}` },
          body: { position: item.position }
        })
      )
    );
  }
};
