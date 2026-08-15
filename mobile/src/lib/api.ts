import type { ApiConfig } from "@/lib/config";
import type { BookmarkCreateInput, BookmarkItem, BookmarkPatch, Folder } from "@/lib/types";

const REQUEST_TIMEOUT_MS = 12000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function messageForStatus(status: number, fallback: string): string {
  if (status === 401) return "키가 올바르지 않습니다.";
  if (status === 503) return "서버가 준비되지 않았습니다.";
  return fallback;
}

async function request<T>(config: ApiConfig, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        "X-Bookmark-Key": config.key,
      },
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ApiError(
      aborted ? "요청 시간이 초과되었습니다." : "서버에 연결할 수 없습니다.",
      0,
      aborted ? "timeout" : "network_error",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let message = `요청이 실패했습니다. (HTTP ${response.status})`;
    let code: string | null = null;
    try {
      const body = (await response.json()) as { message?: string; detail?: string; code?: string };
      code = body.code ?? null;
      message = messageForStatus(response.status, body.message ?? body.detail ?? message);
    } catch {
      message = messageForStatus(response.status, message);
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function listBookmarks(config: ApiConfig): Promise<BookmarkItem[]> {
  return request<BookmarkItem[]>(config, "/api/bookmarks");
}

export function listFolders(config: ApiConfig): Promise<Folder[]> {
  return request<Folder[]>(config, "/api/folders");
}

export function createBookmark(config: ApiConfig, input: BookmarkCreateInput): Promise<BookmarkItem> {
  return request<BookmarkItem>(config, "/api/bookmarks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBookmark(config: ApiConfig, id: string, patch: BookmarkPatch): Promise<BookmarkItem> {
  return request<BookmarkItem>(config, `/api/bookmarks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
