import type {
  BookmarkFormData,
  FolderFormData,
  PositionUpdate,
  SectionFormData
} from "@/app/lib/bookmarks/types";

const BOOKMARK_FIELDS = new Set([
  "title",
  "url",
  "description",
  "isFavorite",
  "folderId"
]);
const FOLDER_FIELDS = new Set(["name", "color", "sectionId"]);
const SECTION_FIELDS = new Set(["name", "color"]);

export class StoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
    this.name = "StoreError";
  }
}

export function invalid(message: string): never {
  throw new StoreError(message, 400);
}

function record(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(`${label} body is invalid.`);
  }
  return value as Record<string, unknown>;
}

export function nonEmptyString(value: unknown, label: string) {
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

export function validateBookmarkCreate(value: unknown): BookmarkFormData {
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
        : nonEmptyString(data.folderId, "Bookmark folderId")
  };
}

export function validateBookmarkPatch(value: unknown): Partial<BookmarkFormData> {
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
  return result;
}

export function validateFolderCreate(value: unknown): FolderFormData {
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
    data.sectionId !== undefined &&
    data.sectionId !== null &&
    typeof data.sectionId !== "string"
  ) {
    invalid("Folder sectionId must be a string or null.");
  }
  return {
    name: nonEmptyString(data.name, "Folder name"),
    color: data.color as string | null | undefined,
    sectionId:
      data.sectionId === undefined || data.sectionId === null
        ? data.sectionId as null | undefined
        : nonEmptyString(data.sectionId, "Folder sectionId")
  };
}

export function validateFolderPatch(value: unknown): Partial<FolderFormData> {
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
  if (Object.hasOwn(data, "sectionId")) {
    if (data.sectionId !== null && typeof data.sectionId !== "string") {
      invalid("Folder sectionId must be a string or null.");
    }
    result.sectionId =
      data.sectionId === null
        ? null
        : nonEmptyString(data.sectionId, "Folder sectionId");
  }
  return result;
}

export function validateSectionPatch(value: unknown): Partial<SectionFormData> {
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
  return result;
}

export function validatePositionUpdates(value: unknown): PositionUpdate[] {
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
