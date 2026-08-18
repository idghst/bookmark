import { StoreError } from "@/app/lib/bookmarks/validation";

type RestRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

function getRestConfig() {
  const rawApiUrl = process.env.BOOKMARK_API_URL?.trim();
  const legacyGraphqlUrl = process.env.BOOKMARK_GRAPHQL_URL?.trim();
  const rawUrl = rawApiUrl || legacyGraphqlUrl;
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

    let pathname = url.pathname.replace(/\/+$/, "");
    if (pathname.endsWith("/graphql")) {
      pathname = pathname.slice(0, -"/graphql".length);
    }
    if (!pathname.endsWith("/api")) pathname = `${pathname}/api`;
    url.pathname = `${pathname}/`;
    url.search = "";
    url.hash = "";
    return { url, apiKey };
  } catch {
    throw new StoreError(
      "BOOKMARK_API_URL must be a valid HTTP(S) URL.",
      500
    );
  }
}

function errorMessage(payload: unknown, response: Response) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) {
      return record.message;
    }
    if (typeof record.detail === "string" && record.detail) {
      return record.detail;
    }
  }
  return response.statusText || "REST request failed.";
}

export async function restRequest<T>(
  path: string,
  options: RestRequestOptions = {}
): Promise<T> {
  const config = getRestConfig();
  const headers = new Headers({
    Accept: "application/json",
    "X-Bookmark-Key": config.apiKey
  });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(new URL(path.replace(/^\/+/, ""), config.url), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  });

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new StoreError(
      response.statusText || "REST response is not valid JSON.",
      response.ok ? 502 : response.status
    );
  }

  if (!response.ok) {
    throw new StoreError(errorMessage(payload, response), response.status);
  }
  return payload as T;
}
