export type BookmarkClientAccess = "authorized" | "configuration_missing";

export function bookmarkClientAccess(): BookmarkClientAccess {
  return process.env.BOOKMARK_API_KEY?.trim() ? "authorized" : "configuration_missing";
}
