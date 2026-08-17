import { StoreError } from "@/app/lib/bookmarks/validation";

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

export async function graphqlRequest<T>(
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

export const BOOKMARK_SELECTION = `
  id title url description isFavorite folderId sectionId position
`;
export const FOLDER_SELECTION = `id name color parentId position`;
export const SECTION_SELECTION = `id name color folderId position`;
