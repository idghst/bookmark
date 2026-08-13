export type BookmarkClientAccess = "authorized" | "configuration_missing" | "unauthorized";

const USERNAME = "bookmark";

function sameValue(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function credentials(authorization: string | null) {
  const match = /^Basic\s+(.+)$/i.exec(authorization?.trim() ?? "");
  if (!match) return null;

  try {
    const encoded = match[1].trim();
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
    );
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

export function bookmarkClientAccess(request: Request): BookmarkClientAccess {
  const apiKey = process.env.BOOKMARK_API_KEY?.trim();
  if (!apiKey) return "configuration_missing";

  const supplied = credentials(request.headers.get("authorization"));
  if (!supplied) return "unauthorized";
  return sameValue(supplied.username, USERNAME) && sameValue(supplied.password, apiKey)
    ? "authorized"
    : "unauthorized";
}

export function bookmarkAuthenticationHeaders() {
  return {
    "Cache-Control": "no-store",
    "WWW-Authenticate": 'Basic realm="Bookmark", charset="UTF-8"'
  };
}
