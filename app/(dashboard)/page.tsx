"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink,
  Globe,
  GripVertical,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countBookmarks, matchesBookmarkFilters } from "@/app/lib/bookmarks/counts";
import { ConsoleSidebar } from "@/app/(dashboard)/ConsoleSidebar";
import {
  flattenFolderResponse,
  folderDescendantIds,
  folderParentId,
  normalizeFolderPositions
} from "@/app/lib/bookmarks/folder-tree";
import { findSectionByName } from "@/app/lib/bookmarks/sections";
import type { BookmarkItem, Folder, FolderTreeItem, Section } from "@/app/lib/bookmarks/types";
import { cn } from "@/lib/utils";

type BookmarkDraft = {
  title: string;
  url: string;
  description: string;
  folderId: string;
  sectionId: string;
  isFavorite: boolean;
};

type BookmarkDialog =
  | { mode: "create"; bookmarkId?: never }
  | { mode: "edit"; bookmarkId: string };

type FolderDialog =
  | { mode: "create"; folderId?: never }
  | { mode: "edit"; folderId: string };

type SectionDialog = {
  sectionId: string;
};

type DeleteTarget =
  | { type: "bookmark"; id: string }
  | { type: "section"; id: string }
  | { type: "folder"; id: string };

type BookmarkCache = {
  version: 2;
  apiBacked: boolean;
  savedAt: number;
  folders: Folder[];
  sections: Section[];
  bookmarks: BookmarkItem[];
  selectedFolderId?: string;
};

const STORAGE_KEY = "bookmark-cache";
const NO_SECTION = "__none__";
const ROOT_FOLDER = "__root__";
const FOLDER_COLORS = ["#4f46e5", "#2166d7", "#16a34a", "#d97706", "#db2777", "#797979"];
const FOLDER_COLOR_FALLBACK = "#797979";
const BOOKMARK_APP_HEADER_CLASS = "min-h-[var(--dashboard-header-height)] lg:h-[var(--dashboard-header-height)]";
const BOOKMARK_TOUCH_TARGET_CLASS = "h-10 w-10";
const BOOKMARK_SECTION_HEADER_CLASS =
  "flex h-12 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-white px-3 transition";

const INITIAL_FOLDERS: Folder[] = [
  { id: "work", name: "작업", color: "#4f46e5", parentId: null, position: 0 },
  { id: "docs", name: "문서", color: "#2166d7", parentId: null, position: 1 },
  { id: "tools", name: "도구", color: "#16a34a", parentId: null, position: 2 },
  { id: "reference", name: "참고", color: "#797979", parentId: "docs", position: 0 }
];

const INITIAL_SECTIONS: Section[] = [
  { id: "daily", name: "매일 확인", folderId: "work", position: 0 },
  { id: "deploy", name: "배포/운영", folderId: "work", position: 1 },
  { id: "frontend", name: "Frontend", folderId: "docs", position: 0 },
  { id: "backend", name: "Backend", folderId: "docs", position: 1 },
  { id: "infra", name: "Infrastructure", folderId: "tools", position: 0 }
];

const INITIAL_BOOKMARKS: BookmarkItem[] = [
  {
    id: "bm-001",
    title: "IDGHST Admin",
    url: "https://github.com/idghst/idghst-admin",
    description: "관리자 화면 저장소",
    isFavorite: true,
    folderId: "work",
    sectionId: "daily",
    position: 0
  },
  {
    id: "bm-002",
    title: "Vercel Dashboard",
    url: "https://vercel.com/dashboard",
    description: "배포와 로그 확인",
    isFavorite: true,
    folderId: "work",
    sectionId: "deploy",
    position: 1
  },
  {
    id: "bm-003",
    title: "Supabase Dashboard",
    url: "https://supabase.com/dashboard",
    description: "DB, Auth, Storage 관리",
    isFavorite: false,
    folderId: "tools",
    sectionId: "infra",
    position: 2
  },
  {
    id: "bm-004",
    title: "Next.js Docs",
    url: "https://nextjs.org/docs",
    description: "App Router 문서",
    isFavorite: false,
    folderId: "docs",
    sectionId: "frontend",
    position: 3
  },
  {
    id: "bm-005",
    title: "Tailwind CSS",
    url: "https://tailwindcss.com/docs",
    description: "유틸리티 클래스 참조",
    isFavorite: false,
    folderId: "docs",
    sectionId: "frontend",
    position: 4
  },
  {
    id: "bm-006",
    title: "Lucide Icons",
    url: "https://lucide.dev/icons",
    description: "아이콘 검색",
    isFavorite: false,
    folderId: "reference",
    sectionId: null,
    position: 5
  },
  {
    id: "bm-007",
    title: "Supabase Data REST API",
    url: "https://supabase.com/docs/guides/api",
    description: "PostgREST 기반 Data API 문서",
    isFavorite: true,
    folderId: "docs",
    sectionId: "backend",
    position: 6
  }
];

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizePositions<T extends { position: number }>(items: T[]) {
  return items.map((item, position) => ({ ...item, position }));
}

function moveById<T extends { id: string; position: number }>(items: T[], activeId: string, targetId: string) {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return normalizePositions(next);
}

type PositionChange = {
  id: string;
  previousPosition: number;
  optimisticPosition: number;
};

function getPositionChanges<T extends { id: string; position: number }>(previous: T[], optimistic: T[]) {
  const previousPositions = new Map(previous.map(({ id, position }) => [id, position]));
  return optimistic.flatMap(({ id, position }) => {
    const previousPosition = previousPositions.get(id);
    return previousPosition === undefined || previousPosition === position
      ? []
      : [{ id, previousPosition, optimisticPosition: position }];
  });
}

function updateMatchingPositions<T extends { id: string; position: number }>(
  items: T[],
  changes: PositionChange[],
  direction: "apply" | "rollback"
) {
  const byId = new Map(changes.map((change) => [change.id, change]));
  return items.map((item) => {
    const change = byId.get(item.id);
    const expectedPosition = direction === "apply" ? change?.previousPosition : change?.optimisticPosition;
    const nextPosition = direction === "apply" ? change?.optimisticPosition : change?.previousPosition;
    return change && item.position === expectedPosition ? { ...item, position: nextPosition } : item;
  });
}

function applyPositions<T extends { id: string; position: number }>(
  items: T[],
  positions: Array<{ id: string; position: number }>
) {
  const byId = new Map(positions.map(({ id, position }) => [id, position]));
  return items.map((item) => (byId.has(item.id) ? { ...item, position: byId.get(item.id)! } : item));
}

async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(path, { ...options, headers });
  if (!response.ok) throw new Error(await readApiError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string") return payload.detail;
  } catch {
    // Fall back to status text below.
  }
  return response.statusText || "API 요청에 실패했습니다.";
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function safeUrl(value: string) {
  try {
    const url = new URL(normalizeUrl(value));
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function bookmarkHost(value: string) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./i, "");
  } catch {
    return value;
  }
}

function emptyBookmarkDraft(folderId: string): BookmarkDraft {
  return {
    title: "",
    url: "",
    description: "",
    folderId,
    sectionId: NO_SECTION,
    isFavorite: false
  };
}

function readBookmarkCache() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;

  const parsed = JSON.parse(saved) as Partial<BookmarkCache>;
  if (!parsed.folders?.length || !Array.isArray(parsed.sections) || !Array.isArray(parsed.bookmarks)) return null;
  return parsed;
}

export default function BookmarksPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [query, setQuery] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [draggingBookmarkId, setDraggingBookmarkId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [dragOverBookmarkId, setDragOverBookmarkId] = useState<string | null>(null);
  const [mobileFoldersOpen, setMobileFoldersOpen] = useState(false);
  const [bookmarkDialog, setBookmarkDialog] = useState<BookmarkDialog | null>(null);
  const [bookmarkDraft, setBookmarkDraft] = useState(() => emptyBookmarkDraft(INITIAL_FOLDERS[0]?.id ?? ""));
  const [bookmarkError, setBookmarkError] = useState("");
  const [sectionCreatorOpen, setSectionCreatorOpen] = useState(false);
  const [sectionNameDraft, setSectionNameDraft] = useState("");
  const [sectionCreateMessage, setSectionCreateMessage] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);
  const [folderDialog, setFolderDialog] = useState<FolderDialog | null>(null);
  const [folderDraft, setFolderDraft] = useState({ name: "", color: FOLDER_COLORS[0], parentId: ROOT_FOLDER });
  const [folderError, setFolderError] = useState("");
  const [sectionDialog, setSectionDialog] = useState<SectionDialog | null>(null);
  const [sectionDraft, setSectionDraft] = useState({ name: "" });
  const [sectionError, setSectionError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [apiBacked, setApiBacked] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mutationQueues = useRef(new Map<string, Promise<void>>());
  const pendingOptimistic = useRef(new Map<symbol, () => void>());
  const favoriteTargets = useRef(new Map<string, boolean>());
  const favoriteReconciliations = useRef(new Set<string>());

  useEffect(() => {
    if (deleteTarget) setDeleteError("");
  }, [deleteTarget]);

  useEffect(() => {
    let cancelled = false;

    function hydrateFromFallback() {
      try {
        const cache = readBookmarkCache();
        if (cache?.folders?.length) {
          setFolders(normalizeFolderPositions(cache.folders));
          setSections(normalizePositions(cache.sections ?? []));
          setBookmarks(normalizePositions(cache.bookmarks ?? []));
          setSelectedFolderId(cache.selectedFolderId ?? cache.folders[0].id);
          setApiBacked(false);
          return true;
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      return false;
    }

    async function loadBookmarks() {
      const hasCache = hydrateFromFallback();
      if (hasCache) setHydrated(true);
      try {
        await refreshBookmarks({
          fallbackToInitial: !hasCache,
          markHydrated: !hasCache,
          isCancelled: () => cancelled
        });
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void loadBookmarks();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        apiBacked,
        savedAt: Date.now(),
        folders,
        sections,
        bookmarks,
        selectedFolderId
      } satisfies BookmarkCache)
    );
  }, [apiBacked, bookmarks, folders, hydrated, sections, selectedFolderId]);

  async function refreshBookmarks({
    fallbackToInitial = false,
    markHydrated = false,
    reapplyOptimistic = false,
    isCancelled = () => false
  }: {
    fallbackToInitial?: boolean;
    markHydrated?: boolean;
    reapplyOptimistic?: boolean;
    isCancelled?: () => boolean;
  } = {}) {
    setRefreshing(true);
    try {
      const [remoteFolders, remoteSections, remoteBookmarks] = await Promise.all([
        apiRequest<FolderTreeItem[]>("/api/folders"),
        apiRequest<Section[]>("/api/sections"),
        apiRequest<BookmarkItem[]>("/api/bookmarks")
      ]);
      if (isCancelled()) return false;
      const flatFolders = flattenFolderResponse(remoteFolders);
      if (!flatFolders.length) throw new Error("폴더 데이터가 없습니다.");
      setFolders(flatFolders);
      setSections(remoteSections);
      setBookmarks(remoteBookmarks);
      setSelectedFolderId((current) => (flatFolders.some((folder) => folder.id === current) ? current : flatFolders[0].id));
      setApiBacked(true);
      if (reapplyOptimistic) pendingOptimistic.current.forEach((reapply) => reapply());
      return true;
    } catch {
      if (fallbackToInitial && !isCancelled()) {
        setFolders(INITIAL_FOLDERS);
        setSections(INITIAL_SECTIONS);
        setBookmarks(INITIAL_BOOKMARKS);
        setSelectedFolderId(INITIAL_FOLDERS[0]?.id ?? "");
        setApiBacked(false);
      }
      return false;
    } finally {
      if (!isCancelled()) {
        setRefreshing(false);
        if (markHydrated) setHydrated(true);
      }
    }
  }

  const orderedFolders = useMemo(() => [...folders].sort((a, b) => a.position - b.position), [folders]);
  const selectedFolder = orderedFolders.find((folder) => folder.id === selectedFolderId) ?? orderedFolders[0] ?? null;

  useEffect(() => {
    if (selectedFolderId && folders.some((folder) => folder.id === selectedFolderId)) return;
    setSelectedFolderId(folders[0]?.id ?? "");
  }, [folders, selectedFolderId]);

  const filtered = useMemo(() => {
    if (!selectedFolder) return [];
    return bookmarks
      .filter((bookmark) => matchesBookmarkFilters(bookmark, { folderId: selectedFolder.id, favoriteOnly, query }))
      .sort((a, b) => a.position - b.position);
  }, [bookmarks, favoriteOnly, query, selectedFolder]);

  const hasActiveFilter = favoriteOnly || query.trim().length > 0;

  const groups = useMemo(() => {
    if (!selectedFolder) return [];
    const folderSections = sections
      .filter((section) => section.folderId === selectedFolder.id)
      .sort((a, b) => a.position - b.position);
    const bySection = new Map<string | null, BookmarkItem[]>();
    filtered.forEach((bookmark) => {
      const key = bookmark.sectionId;
      bySection.set(key, [...(bySection.get(key) ?? []), bookmark]);
    });

    const sectionGroups = folderSections.flatMap((section) => {
      const items = bySection.get(section.id) ?? [];
      return items.length || !hasActiveFilter
        ? [{ id: section.id, label: section.name, items }]
        : [];
    });
    const unassigned = bySection.get(null) ?? [];
    return unassigned.length ? [...sectionGroups, { id: NO_SECTION, label: "섹션 없음", items: unassigned }] : sectionGroups;
  }, [filtered, hasActiveFilter, sections, selectedFolder]);

  const currentFolderBookmarks = selectedFolder
    ? bookmarks.filter((bookmark) => bookmark.folderId === selectedFolder.id)
    : [];
  const currentFavoriteCount = countBookmarks(currentFolderBookmarks, { favoriteOnly: true });
  const currentCount = hasActiveFilter ? filtered.length : currentFolderBookmarks.length;
  const emptyMessage = query ? "검색 결과가 없습니다." : favoriteOnly ? "즐겨찾기한 북마크가 없습니다." : "북마크가 없습니다.";
  const folderSections = sections
    .filter((section) => section.folderId === bookmarkDraft.folderId)
    .sort((a, b) => a.position - b.position);
  const parentFolderOptions = folderDialog?.mode === "edit"
    ? orderedFolders.filter((folder) => {
        const blocked = folderDescendantIds(folders, folderDialog.folderId);
        return folder.id !== folderDialog.folderId && !blocked.has(folder.id);
      })
    : orderedFolders;

  function selectFolder(folderId: string) {
    setSelectedFolderId(folderId);
    setMobileFoldersOpen(false);
  }

  function requestFolderDelete(folder: Folder) {
    if (folders.some((item) => folderParentId(item) === folder.id)) {
      setMutationError("하위 폴더를 먼저 이동하거나 삭제하세요.");
      return;
    }
    setDeleteTarget({ type: "folder", id: folder.id });
  }

  function openBookmarkDialog(bookmark?: BookmarkItem) {
    if (bootstrapping) return;
    setBookmarkError("");
    setSectionCreatorOpen(false);
    setSectionNameDraft("");
    setSectionCreateMessage("");
    if (bookmark) {
      setBookmarkDialog({ mode: "edit", bookmarkId: bookmark.id });
      setBookmarkDraft({
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description ?? "",
        folderId: bookmark.folderId ?? selectedFolder?.id ?? orderedFolders[0]?.id ?? "",
        sectionId: bookmark.sectionId ?? NO_SECTION,
        isFavorite: bookmark.isFavorite
      });
      return;
    }

    setBookmarkDialog({ mode: "create" });
    setBookmarkDraft(emptyBookmarkDraft(selectedFolder?.id ?? orderedFolders[0]?.id ?? ""));
  }

  function openFolderDialog(folder?: Folder, parentId: string | null = null) {
    if (bootstrapping) return;
    setFolderError("");
    if (folder) {
      setFolderDialog({ mode: "edit", folderId: folder.id });
      setFolderDraft({
        name: folder.name,
        color: folder.color ?? FOLDER_COLOR_FALLBACK,
        parentId: folderParentId(folder) ?? ROOT_FOLDER
      });
      return;
    }
    setFolderDialog({ mode: "create" });
    setFolderDraft({
      name: "",
      color: FOLDER_COLORS[folders.length % FOLDER_COLORS.length],
      parentId: parentId ?? ROOT_FOLDER
    });
  }

  function openSectionDialog(section: Section) {
    if (bootstrapping) return;
    setSectionError("");
    setSectionDialog({ sectionId: section.id });
    setSectionDraft({ name: section.name });
  }

  async function createSectionFromBookmarkDialog() {
    if (bootstrapping || creatingSection) return;
    const name = sectionNameDraft.trim();
    if (!name) {
      setSectionCreateMessage("섹션 이름을 입력하세요.");
      return;
    }

    const existing = findSectionByName(sections, bookmarkDraft.folderId, name);
    if (existing) {
      setSectionCreateMessage(`“${existing.name}” 섹션이 이미 있습니다. 목록에서 선택하세요.`);
      return;
    }

    setCreatingSection(true);
    setSectionCreateMessage("");
    try {
      const section = apiBacked
        ? await apiRequest<Section>("/api/sections", {
            method: "POST",
            body: JSON.stringify({ folderId: bookmarkDraft.folderId, name })
          })
        : {
            id: createId("section"),
            name,
            folderId: bookmarkDraft.folderId,
            position: sections.filter((item) => item.folderId === bookmarkDraft.folderId).length
          };
      setSections((current) => current.some((item) => item.id === section.id) ? current : [...current, section]);
      setSectionNameDraft("");
      setSectionCreatorOpen(false);
      setSectionCreateMessage(`“${section.name}” 섹션을 만들었습니다. 목록에서 선택하세요.`);
    } catch (error) {
      setSectionCreateMessage(error instanceof Error ? error.message : "섹션 생성에 실패했습니다.");
    } finally {
      setCreatingSection(false);
    }
  }

  async function saveBookmark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bootstrapping || saving || creatingSection) return;
    const title = bookmarkDraft.title.trim();
    const url = safeUrl(bookmarkDraft.url);
    if (!title) {
      setBookmarkError("제목을 입력하세요.");
      return;
    }
    if (!url) {
      setBookmarkError("http 또는 https URL을 입력하세요.");
      return;
    }
    if (!folders.some((folder) => folder.id === bookmarkDraft.folderId)) {
      setBookmarkError("폴더를 선택하세요.");
      return;
    }

    setBookmarkError("");
    setSaving(true);
    const resolvedSectionId = bookmarkDraft.sectionId === NO_SECTION ? null : bookmarkDraft.sectionId;
    try {
      const payload = {
          title,
          url,
          description: bookmarkDraft.description.trim() || null,
          folderId: bookmarkDraft.folderId,
          sectionId: resolvedSectionId,
          isFavorite: bookmarkDraft.isFavorite
        };

      if (bookmarkDialog?.mode === "edit") {
        if (apiBacked) {
          const updated = await apiRequest<BookmarkItem>(`/api/bookmarks/${bookmarkDialog.bookmarkId}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
          });
          setBookmarks((current) => current.map((bookmark) => (bookmark.id === updated.id ? updated : bookmark)));
        } else {
          setBookmarks((current) =>
            current.map((bookmark) => (bookmark.id === bookmarkDialog.bookmarkId ? { ...bookmark, ...payload } : bookmark))
          );
        }
      } else if (apiBacked) {
        const created = await apiRequest<BookmarkItem>("/api/bookmarks", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setBookmarks((current) => [...current, created]);
      } else {
        setBookmarks((current) => [
          ...current,
          {
            id: createId("bm"),
            ...payload,
            position: current.length
          }
        ]);
      }

      setBookmarkDialog(null);
    } catch (error) {
      setBookmarkError(error instanceof Error ? error.message : "북마크 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bootstrapping || saving) return;
    const name = folderDraft.name.trim();
    if (!name) {
      setFolderError("폴더 이름을 입력하세요.");
      return;
    }
    const parentId = folderDraft.parentId === ROOT_FOLDER ? null : folderDraft.parentId;
    const editingFolder = folderDialog?.mode === "edit"
      ? folders.find((folder) => folder.id === folderDialog.folderId)
      : undefined;
    const forbiddenParentIds = editingFolder ? folderDescendantIds(folders, editingFolder.id) : new Set<string>();
    if (parentId && (!folders.some((folder) => folder.id === parentId) || parentId === editingFolder?.id || forbiddenParentIds.has(parentId))) {
      setFolderError("상위 폴더로 자신 또는 하위 폴더를 선택할 수 없습니다.");
      return;
    }

    setFolderError("");
    setSaving(true);
    try {
      if (folderDialog?.mode === "edit") {
        if (apiBacked) {
          const updated = await apiRequest<Folder>(`/api/folders/${folderDialog.folderId}`, {
            method: "PATCH",
            body: JSON.stringify({ name, color: folderDraft.color, parentId })
          });
          setFolders((current) => normalizeFolderPositions(current.map((folder) => (folder.id === updated.id ? updated : folder))));
        } else {
          setFolders((current) => {
            const existing = current.find((folder) => folder.id === folderDialog.folderId);
            const position = existing && folderParentId(existing) === parentId
              ? existing.position
              : current.filter((folder) => folderParentId(folder) === parentId).length;
            return normalizeFolderPositions(
              current.map((folder) =>
                folder.id === folderDialog.folderId
                  ? { ...folder, name, color: folderDraft.color, parentId, position }
                  : folder
              )
            );
          });
        }
      } else {
        const folder = apiBacked
          ? await apiRequest<Folder>("/api/folders", {
              method: "POST",
              body: JSON.stringify({ name, color: folderDraft.color, parentId })
            })
          : {
              id: createId("folder"),
              name,
              color: folderDraft.color,
              parentId,
              position: folders.filter((item) => folderParentId(item) === parentId).length
            };
        setFolders((current) => normalizeFolderPositions([...current, folder]));
        setSelectedFolderId(folder.id);
      }

      setFolderDialog(null);
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "폴더 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bootstrapping || saving || !sectionDialog) return;
    const name = sectionDraft.name.trim();
    if (!name) {
      setSectionError("섹션 이름을 입력하세요.");
      return;
    }

    setSectionError("");
    setSaving(true);
    try {
      if (apiBacked) {
        const updated = await apiRequest<Section>(`/api/sections/${sectionDialog.sectionId}`, {
          method: "PATCH",
          body: JSON.stringify({ name })
        });
        setSections((current) => current.map((section) => (section.id === updated.id ? updated : section)));
      } else {
        setSections((current) =>
          current.map((section) =>
            section.id === sectionDialog.sectionId ? { ...section, name } : section
          )
        );
      }
      setSectionDialog(null);
    } catch (error) {
      setSectionError(error instanceof Error ? error.message : "섹션 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (bootstrapping || !deleteTarget || deleting) return;

    setDeleteError("");
    setDeleting(true);
    try {
      if (deleteTarget.type === "bookmark") {
        if (apiBacked) {
          await apiRequest<void>(`/api/bookmarks/${deleteTarget.id}`, { method: "DELETE" });
        }
        setBookmarks((current) => normalizePositions(current.filter((bookmark) => bookmark.id !== deleteTarget.id)));
        setDeleteTarget(null);
        return;
      }

      if (deleteTarget.type === "section") {
        if (apiBacked) {
          await apiRequest<void>(`/api/sections/${deleteTarget.id}`, { method: "DELETE" });
        }
        setSections((current) => normalizePositions(current.filter((section) => section.id !== deleteTarget.id)));
        setBookmarks((current) => current.map((bookmark) => bookmark.sectionId === deleteTarget.id ? { ...bookmark, sectionId: null } : bookmark));
        setBookmarkDraft((draft) => draft.sectionId === deleteTarget.id ? { ...draft, sectionId: NO_SECTION } : draft);
        setDeleteTarget(null);
        return;
      }

      if (folders.length <= 1) {
        setFolderError("마지막 폴더는 삭제할 수 없습니다.");
        setDeleteTarget(null);
        return;
      }

      const folderToDelete = folders.find((folder) => folder.id === deleteTarget.id);
      const hasChildren = folders.some((folder) => folderParentId(folder) === deleteTarget.id);
      if (!folderToDelete || hasChildren) {
        setDeleteError("하위 폴더를 먼저 이동하거나 삭제하세요.");
        return;
      }
      const fallbackFolderId =
        folders.find((folder) => folder.id !== deleteTarget.id && folder.id !== folderParentId(folderToDelete))?.id
        ?? folderParentId(folderToDelete)
        ?? "";
      if (!fallbackFolderId) {
        setDeleteError("북마크를 이동할 대상 폴더가 없습니다.");
        return;
      }
      if (apiBacked) {
        await apiRequest<void>(`/api/folders/${deleteTarget.id}?destination_folder_id=${encodeURIComponent(fallbackFolderId)}`, { method: "DELETE" });
      }
      setFolders((current) => normalizeFolderPositions(current.filter((folder) => folder.id !== deleteTarget.id)));
      setSections((current) => normalizePositions(current.filter((section) => section.folderId !== deleteTarget.id)));
      setBookmarks((current) =>
        current.map((bookmark) =>
          bookmark.folderId === deleteTarget.id
            ? { ...bookmark, folderId: fallbackFolderId, sectionId: null }
            : bookmark
        )
      );
      if (selectedFolderId === deleteTarget.id) setSelectedFolderId(fallbackFolderId);
      if (apiBacked) await refreshBookmarks();
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  function persistOptimisticMutation(
    key: string,
    apply: () => void,
    rollback: () => void,
    request: () => Promise<unknown>,
    fallbackMessage: string,
    reconcileOnFailure: boolean | (() => boolean) = false
  ) {
    if (bootstrapping) return;
    setMutationError("");
    apply();
    if (!apiBacked) return;

    const token = Symbol(key);
    pendingOptimistic.current.set(token, apply);
    const previous = mutationQueues.current.get(key) ?? Promise.resolve();
    const queued = previous.catch(() => undefined).then(async () => {
      apply();
      try {
        await request();
        pendingOptimistic.current.delete(token);
      } catch (error) {
        pendingOptimistic.current.delete(token);
        const shouldReconcile = typeof reconcileOnFailure === "function"
          ? reconcileOnFailure()
          : reconcileOnFailure;
        const refreshed = shouldReconcile
          ? await refreshBookmarks({ reapplyOptimistic: true })
          : false;
        if (!refreshed) rollback();
        setMutationError(error instanceof Error ? error.message : fallbackMessage);
      }
    });
    mutationQueues.current.set(key, queued);
    void queued.finally(() => {
      if (mutationQueues.current.get(key) === queued) mutationQueues.current.delete(key);
    });
    return queued;
  }

  function toggleFavorite(id: string) {
    if (bootstrapping) return;
    const bookmark = bookmarks.find((item) => item.id === id);
    if (!bookmark) return;
    if (favoriteTargets.current.has(id)) favoriteReconciliations.current.add(id);
    const previousFavorite = favoriteTargets.current.get(id) ?? bookmark.isFavorite;
    const optimisticFavorite = !previousFavorite;
    favoriteTargets.current.set(id, optimisticFavorite);
    const mutation = persistOptimisticMutation(
      `favorite:${id}`,
      () =>
        setBookmarks((current) =>
          current.map((item) =>
            item.id === id && item.isFavorite === previousFavorite
              ? { ...item, isFavorite: optimisticFavorite }
              : item
          )
        ),
      () =>
        setBookmarks((current) =>
          current.map((item) =>
            item.id === id && item.isFavorite === optimisticFavorite
              ? { ...item, isFavorite: previousFavorite }
              : item
          )
        ),
      () =>
        apiRequest<BookmarkItem>(`/api/bookmarks/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ isFavorite: optimisticFavorite })
        }),
      "즐겨찾기 변경에 실패했습니다.",
      () => favoriteReconciliations.current.has(id)
    );
    if (!mutation) {
      favoriteTargets.current.delete(id);
      favoriteReconciliations.current.delete(id);
      return;
    }
    void mutation.finally(() => {
      if (favoriteTargets.current.get(id) === optimisticFavorite) {
        favoriteTargets.current.delete(id);
        favoriteReconciliations.current.delete(id);
      }
    });
  }

  function dropFolder(targetFolderId: string) {
    if (bootstrapping || !draggingFolderId) return;
    const source = folders.find((folder) => folder.id === draggingFolderId);
    const target = folders.find((folder) => folder.id === targetFolderId);
    if (!source || !target || folderParentId(source) !== folderParentId(target)) {
      setDraggingFolderId(null);
      setDragOverFolderId(null);
      return;
    }
    const siblings = folders
      .filter((folder) => folderParentId(folder) === folderParentId(source))
      .sort((a, b) => a.position - b.position);
    const moved = moveById(siblings, draggingFolderId, targetFolderId);
    const changes = getPositionChanges(siblings, moved);
    if (!changes.length) {
      setDraggingFolderId(null);
      setDragOverFolderId(null);
      return;
    }
    void persistOptimisticMutation(
      "reorder:folders",
      () => setFolders((current) => applyPositions(current, moved)),
      () => setFolders((current) => updateMatchingPositions(current, changes, "rollback")),
      () => apiRequest<void>("/api/folders/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
      "폴더 순서 저장에 실패했습니다.",
      true
    );
    setDraggingFolderId(null);
    setDragOverFolderId(null);
  }

  function dropSection(targetSectionId: string) {
    if (bootstrapping || !selectedFolder || !draggingSectionId) return;
    const scoped = sections.filter((section) => section.folderId === selectedFolder.id).sort((a, b) => a.position - b.position);
    const moved = moveById(scoped, draggingSectionId, targetSectionId);
    const changes = getPositionChanges(scoped, moved);
    void persistOptimisticMutation(
      `reorder:sections:${selectedFolder.id}`,
      () => setSections((current) => applyPositions(current, moved)),
      () => setSections((current) => updateMatchingPositions(current, changes, "rollback")),
      () => apiRequest<void>("/api/sections/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
      "섹션 순서 저장에 실패했습니다.",
      true
    );
    setDraggingSectionId(null);
    setDragOverSectionId(null);
  }

  function dropBookmark(targetBookmarkId: string) {
    if (bootstrapping || !selectedFolder || !draggingBookmarkId) return;
    const active = bookmarks.find((bookmark) => bookmark.id === draggingBookmarkId);
    const target = bookmarks.find((bookmark) => bookmark.id === targetBookmarkId);
    if (!active || !target || active.folderId !== selectedFolder.id || active.sectionId !== target.sectionId) {
      setDraggingBookmarkId(null);
      setDragOverBookmarkId(null);
      return;
    }
    const scoped = bookmarks
      .filter((bookmark) => bookmark.folderId === selectedFolder.id && bookmark.sectionId === active.sectionId)
      .sort((a, b) => a.position - b.position);
    const moved = moveById(scoped, draggingBookmarkId, targetBookmarkId);
    const changes = getPositionChanges(scoped, moved);
    void persistOptimisticMutation(
      `reorder:bookmarks:${selectedFolder.id}:${active.sectionId ?? NO_SECTION}`,
      () => setBookmarks((current) => applyPositions(current, moved)),
      () => setBookmarks((current) => updateMatchingPositions(current, changes, "rollback")),
      () => apiRequest<void>("/api/bookmarks/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
      "북마크 순서 저장에 실패했습니다.",
      true
    );
    setDraggingBookmarkId(null);
    setDragOverBookmarkId(null);
  }

  function dragOverBookmark(targetBookmarkId: string) {
    if (bootstrapping) return;
    const active = bookmarks.find((bookmark) => bookmark.id === draggingBookmarkId);
    const target = bookmarks.find((bookmark) => bookmark.id === targetBookmarkId);
    setDragOverBookmarkId(active?.folderId === target?.folderId && active?.sectionId === target?.sectionId ? targetBookmarkId : null);
  }

  if (!hydrated) {
    return <BookmarksLoading />;
  }

  return (
    <div
      className="fade-in flex h-full min-h-0 overflow-hidden bg-white"
      aria-busy={bootstrapping}
    >
      <ConsoleSidebar
        folders={orderedFolders}
        bookmarks={bookmarks}
        favoriteOnly={favoriteOnly}
        selectedFolderId={selectedFolder?.id ?? ""}
        draggingFolderId={draggingFolderId}
        dragOverFolderId={dragOverFolderId}
        onSelectFolder={selectFolder}
        onAddFolder={(parentId) => openFolderDialog(undefined, parentId ?? null)}
        onEditFolder={openFolderDialog}
        onDeleteFolder={requestFolderDelete}
        onRefresh={() => void refreshBookmarks()}
        refreshing={refreshing}
        mutationsDisabled={bootstrapping}
        onDragFolder={(id) => {
          if (bootstrapping) return;
          setDraggingFolderId(id);
          if (!id) setDragOverFolderId(null);
        }}
        onDragOverFolder={setDragOverFolderId}
        onDropFolder={dropFolder}
        className="hidden lg:flex"
      />

      {mobileFoldersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="북마크 메뉴" onKeyDown={(event) => event.key === "Escape" && setMobileFoldersOpen(false)}>
          <button
            type="button"
            aria-label="폴더 메뉴 닫기"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileFoldersOpen(false)}
          />
          <ConsoleSidebar
            id="mobile-console-sidebar"
            folders={orderedFolders}
            bookmarks={bookmarks}
            favoriteOnly={favoriteOnly}
            selectedFolderId={selectedFolder?.id ?? ""}
            draggingFolderId={draggingFolderId}
            dragOverFolderId={dragOverFolderId}
            onSelectFolder={selectFolder}
            onAddFolder={(parentId) => openFolderDialog(undefined, parentId ?? null)}
            onEditFolder={openFolderDialog}
            onDeleteFolder={requestFolderDelete}
            onRefresh={() => void refreshBookmarks()}
            refreshing={refreshing}
            mutationsDisabled={bootstrapping}
            onDragFolder={(id) => {
              if (bootstrapping) return;
              setDraggingFolderId(id);
              if (!id) setDragOverFolderId(null);
            }}
            onDragOverFolder={setDragOverFolderId}
            onDropFolder={dropFolder}
            className="absolute inset-y-0 left-0 flex shadow-2xl"
          />
        </div>
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="shrink-0 border-b border-[var(--border-subtle)] bg-white px-3 py-2 lg:hidden"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className={BOOKMARK_TOUCH_TARGET_CLASS} onClick={() => setMobileFoldersOpen(true)} aria-expanded={mobileFoldersOpen} aria-controls="mobile-console-sidebar">
              <Menu className="h-5 w-5" />
              <span className="sr-only">폴더 메뉴 열기</span>
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h1 className="truncate text-lg font-bold text-[var(--text-heading)]">{selectedFolder?.name ?? "북마크"}</h1>
              <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[#F8FAFC] px-2 text-xs tabular-nums text-[var(--text-muted)]">
                {currentCount}
              </span>
            </div>
            <Button
              variant={favoriteOnly ? "default" : "outline"}
              size="icon"
              data-template-action-ignore
              aria-pressed={favoriteOnly}
              aria-label={`즐겨찾기 ${currentFavoriteCount}개만 보기`}
              onClick={() => setFavoriteOnly((value) => !value)}
              className={BOOKMARK_TOUCH_TARGET_CLASS}
            >
              <Star className={cn("h-4 w-4", favoriteOnly && "fill-current")} />
            </Button>
          </div>
          <label className="relative mt-2 block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="북마크 검색..."
              className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[#F8FAFC] pl-10 pr-11 text-sm outline-none transition focus:border-[var(--color-brand)] focus:bg-white"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[var(--text-muted)] hover:bg-white"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">검색어 지우기</span>
              </button>
            ) : null}
          </label>
        </header>

        <header
          className={cn(
            "hidden shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border-subtle)] bg-white px-5 lg:grid",
            BOOKMARK_APP_HEADER_CLASS
          )}
        >
          <div className="flex min-w-0 max-w-[clamp(9rem,16vw,18rem)] items-center gap-2">
            <h1 className="truncate text-lg font-bold text-[var(--text-heading)]">{selectedFolder?.name ?? "북마크"}</h1>
            <span className="flex h-6 min-w-6 items-center justify-center rounded border border-[var(--border-subtle)] bg-[#F8FAFC] px-2 text-xs tabular-nums text-[var(--text-muted)]">
              {currentCount}
            </span>
          </div>
          <label className="relative min-w-0">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="북마크 검색..."
              className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[#F8FAFC] pl-11 pr-11 text-sm outline-none transition focus:border-[var(--color-brand)] focus:bg-white"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[var(--text-muted)] hover:bg-white"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">검색어 지우기</span>
              </button>
            ) : null}
          </label>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant={favoriteOnly ? "default" : "outline"}
              size="sm"
              data-template-action-ignore
              onClick={() => setFavoriteOnly((value) => !value)}
              className="h-10 px-3 text-sm"
            >
              <Star className={cn("h-4 w-4", favoriteOnly && "fill-current")} />
              즐겨찾기
              <span className="tabular-nums">{currentFavoriteCount}</span>
            </Button>
            <Button size="sm" disabled={bootstrapping || !selectedFolder} onClick={() => openBookmarkDialog()} className="h-10 px-3 text-sm">
              <Plus className="h-4 w-4" />
              북마크 추가
            </Button>
          </div>
        </header>

        <main id="bookmark-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="mx-auto w-full max-w-[1480px] space-y-4 p-[clamp(0.75rem,2vw,2rem)]">
            {mutationError ? (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-bold text-destructive">
                {mutationError}
              </div>
            ) : null}
            {filtered.length === 0 && (hasActiveFilter || groups.length === 0) ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white px-6 text-center">
                <div className="mb-3 h-1.5 w-12 rounded-full bg-[var(--color-brand)]" />
                <p className="text-base font-bold text-[var(--text-heading)]">{emptyMessage}</p>
                <Button className="mt-4" size="sm" disabled={bootstrapping || !selectedFolder} onClick={() => openBookmarkDialog()}>
                  <Plus className="h-4 w-4" />
                  북마크 추가
                </Button>
              </div>
            ) : (
              groups.map((group) => (
                <section key={group.id} className="space-y-3">
                  <div
                    draggable={!bootstrapping && group.id !== NO_SECTION}
                    onDragStart={() => {
                      if (!bootstrapping && group.id !== NO_SECTION) setDraggingSectionId(group.id);
                    }}
                    onDragEnd={() => {
                      setDraggingSectionId(null);
                      setDragOverSectionId(null);
                    }}
                    onDragOver={(event) => {
                      if (!draggingSectionId) return;
                      event.preventDefault();
                      setDragOverSectionId(group.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggingSectionId && group.id !== NO_SECTION) dropSection(group.id);
                    }}
                    className={cn(
                      BOOKMARK_SECTION_HEADER_CLASS,
                      dragOverSectionId === group.id && "border-[var(--color-brand)] bg-indigo-50/60 ring-2 ring-[var(--color-brand)]/25",
                      draggingSectionId === group.id && "opacity-60"
                    )}
                  >
                    <span className="h-6 w-1 shrink-0 bg-[var(--color-brand)]" />
                    <h2 className="min-w-0 flex-1 truncate text-lg font-bold leading-snug text-[var(--text-heading)]">{group.label}</h2>
                    <span className="shrink-0 rounded border border-[var(--border-subtle)] bg-[#F8FAFC] px-2 py-1 text-xs tabular-nums text-[var(--text-muted)]">
                      {group.items.length}
                    </span>
                    {group.id !== NO_SECTION ? (
                      <>
                        <button
                          type="button"
                          disabled={bootstrapping}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[#F8FAFC]"
                          onClick={(event) => {
                            event.stopPropagation();
                            const section = sections.find((item) => item.id === group.id);
                            if (section) openSectionDialog(section);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">{group.label} 섹션 편집</span>
                        </button>
                        <button
                          type="button"
                          disabled={bootstrapping}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-red-50 hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget({ type: "section", id: group.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">{group.label} 섹션 삭제</span>
                        </button>
                        <button
                          type="button"
                          disabled={bootstrapping}
                          draggable={!bootstrapping}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[#F8FAFC]"
                          onDragStart={() => {
                            if (!bootstrapping) setDraggingSectionId(group.id);
                          }}
                          onDragEnd={() => {
                            setDraggingSectionId(null);
                            setDragOverSectionId(null);
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => dropSection(group.id)}
                        >
                          <GripVertical className="h-4 w-4" />
                          <span className="sr-only">{group.label} 섹션 순서 변경</span>
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4" aria-label={`${group.label} 북마크, 드래그해서 위치 변경`}>
                    {group.items.map((bookmark) => (
                      <BookmarkCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        folder={selectedFolder}
                        section={sections.find((section) => section.id === bookmark.sectionId) ?? null}
                        dragging={draggingBookmarkId === bookmark.id}
                        dragOver={dragOverBookmarkId === bookmark.id}
                        mutationsDisabled={bootstrapping}
                        onDragStart={(id) => {
                          if (!bootstrapping) setDraggingBookmarkId(id);
                        }}
                        onDragEnd={() => {
                          setDraggingBookmarkId(null);
                          setDragOverBookmarkId(null);
                          setDragOverSectionId(null);
                        }}
                        onDragOver={dragOverBookmark}
                        onDrop={dropBookmark}
                        onEdit={openBookmarkDialog}
                        onDelete={(item) => setDeleteTarget({ type: "bookmark", id: item.id })}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </main>

        <Button
          size="icon-lg"
          disabled={bootstrapping || !selectedFolder}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 h-12 w-12 shadow-lg lg:hidden"
          onClick={() => openBookmarkDialog()}
        >
          <Plus className="h-5 w-5" />
          <span className="sr-only">북마크 추가</span>
        </Button>
      </section>

      {bookmarkDialog ? (
        <Modal title={bookmarkDialog.mode === "edit" ? "북마크 편집" : "북마크 추가"} onClose={() => setBookmarkDialog(null)} closeDisabled={saving || creatingSection}>
          <form className="space-y-4" onSubmit={saveBookmark} aria-busy={saving || creatingSection}>
            <Field label="URL">
              <Input
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                value={bookmarkDraft.url}
                onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, url: event.target.value }))}
                placeholder="https://example.com"
              />
            </Field>
            <Field label="제목">
              <Input value={bookmarkDraft.title} onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="북마크 제목" />
            </Field>
            <Field label="설명">
              <Textarea value={bookmarkDraft.description} onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, description: event.target.value }))} placeholder="간단한 설명" rows={2} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="폴더">
                <Select
                  value={bookmarkDraft.folderId}
                  onValueChange={(folderId) => {
                    setBookmarkDraft((draft) => ({ ...draft, folderId, sectionId: NO_SECTION }));
                    setSectionCreatorOpen(false);
                    setSectionNameDraft("");
                    setSectionCreateMessage("");
                  }}
                >
                  <SelectTrigger aria-label="폴더" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {orderedFolders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="섹션">
                <Select
                  value={bookmarkDraft.sectionId}
                  onValueChange={(sectionId) => {
                    setBookmarkDraft((draft) => ({ ...draft, sectionId }));
                    setSectionCreateMessage("");
                  }}
                >
                  <SelectTrigger aria-label="섹션" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SECTION}>없음</SelectItem>
                    {folderSections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="space-y-2">
              {!sectionCreatorOpen ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSectionCreatorOpen(true);
                      setSectionCreateMessage("");
                    }}
                  >
                    <Plus />
                    새 섹션 만들기
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    disabled={bookmarkDraft.sectionId === NO_SECTION}
                    onClick={() => setDeleteTarget({ type: "section", id: bookmarkDraft.sectionId })}
                  >
                    <Trash2 />
                    선택한 섹션 삭제
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3">
                  <Field label="새 섹션 이름">
                    <Input
                      autoFocus
                      value={sectionNameDraft}
                      onChange={(event) => setSectionNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void createSectionFromBookmarkDialog();
                        }
                      }}
                      placeholder="섹션 이름"
                    />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="새 섹션 만들기 취소"
                      disabled={creatingSection}
                      onClick={() => {
                        setSectionCreatorOpen(false);
                        setSectionNameDraft("");
                        setSectionCreateMessage("");
                      }}
                    >
                      취소
                    </Button>
                    <Button type="button" size="sm" disabled={creatingSection} onClick={() => void createSectionFromBookmarkDialog()}>
                      {creatingSection ? <LoaderCircle className="animate-spin" /> : null}
                      {creatingSection ? "만드는 중..." : "만들기"}
                    </Button>
                  </div>
                </div>
              )}
              {sectionCreateMessage ? <p role="status" className="text-xs font-medium text-[var(--text-muted)]">{sectionCreateMessage}</p> : null}
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-heading)]">
              <input
                type="checkbox"
                checked={bookmarkDraft.isFavorite}
                onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, isFavorite: event.target.checked }))}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              즐겨찾기
            </label>
            {saving ? <DatabaseProgressStatus title="데이터베이스에 저장 중" /> : null}
            {bookmarkError ? <p className="text-sm font-bold text-destructive">{bookmarkError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" disabled={saving || creatingSection} onClick={() => setBookmarkDialog(null)}>
                취소
              </Button>
              <Button type="submit" disabled={saving || creatingSection}>
                {saving ? <LoaderCircle className="animate-spin" /> : null}
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {folderDialog ? (
        <Modal title={folderDialog.mode === "edit" ? "폴더 편집" : "새 폴더"} onClose={() => setFolderDialog(null)} closeDisabled={saving}>
          <form className="space-y-4" onSubmit={saveFolder} aria-busy={saving}>
            <Field label="이름">
              <Input value={folderDraft.name} onChange={(event) => setFolderDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="폴더 이름" />
            </Field>
            <Field label="상위 폴더">
              <Select value={folderDraft.parentId} onValueChange={(parentId) => setFolderDraft((draft) => ({ ...draft, parentId }))}>
                <SelectTrigger aria-label="상위 폴더" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_FOLDER}>최상위 폴더</SelectItem>
                  {parentFolderOptions.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="색상">
              <div className="flex flex-wrap gap-2">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`색상 ${color}`}
                    onClick={() => setFolderDraft((draft) => ({ ...draft, color }))}
                    className={cn(
                      "h-8 w-8 rounded border border-[var(--border-subtle)]",
                      folderDraft.color === color && "ring-2 ring-[var(--color-brand)] ring-offset-2"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </Field>
            {saving ? <DatabaseProgressStatus title="데이터베이스에 저장 중" /> : null}
            {folderError ? <p className="text-sm font-bold text-destructive">{folderError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" disabled={saving} onClick={() => setFolderDialog(null)}>
                취소
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="animate-spin" /> : null}
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {sectionDialog ? (
        <Modal title="섹션 편집" onClose={() => setSectionDialog(null)} closeDisabled={saving}>
          <form className="space-y-4" onSubmit={saveSection} aria-busy={saving}>
            <Field label="이름">
              <Input value={sectionDraft.name} onChange={(event) => setSectionDraft({ name: event.target.value })} placeholder="섹션 이름" />
            </Field>
            {saving ? <DatabaseProgressStatus title="데이터베이스에 저장 중" /> : null}
            {sectionError ? <p className="text-sm font-bold text-destructive">{sectionError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" disabled={saving} onClick={() => setSectionDialog(null)}>
                취소
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="animate-spin" /> : null}
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal
          title={deleteTarget.type === "bookmark" ? "북마크 삭제" : deleteTarget.type === "section" ? "섹션 삭제" : "폴더 삭제"}
          onClose={() => setDeleteTarget(null)}
          closeDisabled={deleting}
        >
          <p className="text-sm text-[var(--text-secondary)]">
            {deleteTarget.type === "bookmark"
              ? "이 북마크를 삭제합니다."
              : deleteTarget.type === "section"
                ? "이 섹션을 삭제합니다. 북마크는 삭제하지 않고 섹션 없음으로 이동합니다."
              : "이 폴더를 삭제하고, 안의 북마크는 다른 폴더로 안전하게 이동합니다. 하위 폴더가 있으면 먼저 이동해야 합니다."}
          </p>
          {deleting ? (
            <div className="mt-4">
              <DatabaseProgressStatus title="데이터베이스에서 삭제 중" />
            </div>
          ) : null}
          {deleteError ? <p className="mt-4 text-sm font-bold text-destructive">{deleteError}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? <LoaderCircle className="animate-spin" /> : null}
              {deleting ? "삭제 중..." : "삭제"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function BookmarksLoading() {
  return (
    <div className="fade-in flex h-full min-h-0 overflow-hidden bg-white">
      <aside className="hidden w-[20rem] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[#F8FAFC] xl:w-[22rem] lg:flex">
        <div className={cn("flex shrink-0 flex-col justify-center border-b border-[var(--border-subtle)] px-4 py-3", BOOKMARK_APP_HEADER_CLASS)}>
          <div className="h-5 w-24 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-32 rounded bg-slate-100" />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-10 rounded border border-[var(--border-subtle)] bg-white" />
          ))}
        </div>
        <div className="mt-auto border-t border-[var(--border-subtle)] p-4">
          <div className="h-12 rounded bg-slate-100" />
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border-subtle)] bg-white px-4 md:px-5",
            BOOKMARK_APP_HEADER_CLASS
          )}
        >
          <div className="hidden h-5 w-28 rounded bg-slate-200 md:block" />
          <div className="h-9 min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[#F8FAFC]" />
          <div className="h-7 w-24 rounded bg-slate-100" />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="mx-auto w-full max-w-[1480px] space-y-5 p-4 md:p-6 lg:p-8">
            <div className={BOOKMARK_SECTION_HEADER_CLASS}>
              <span className="h-7 w-1 bg-[var(--color-brand)]" />
              <div className="h-7 w-32 rounded bg-slate-200" />
              <div className="ml-auto h-7 w-8 rounded border border-[var(--border-subtle)] bg-[#F8FAFC]" />
            </div>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-[104px] rounded-lg border border-[var(--border-subtle)] bg-white" />
            ))}
          </div>
        </main>
      </section>
    </div>
  );
}

function BookmarkCard({
  bookmark,
  folder,
  section,
  dragging,
  dragOver,
  mutationsDisabled,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onEdit,
  onDelete,
  onToggleFavorite
}: {
  bookmark: BookmarkItem;
  folder: Folder | null;
  section: Section | null;
  dragging: boolean;
  dragOver: boolean;
  mutationsDisabled: boolean;
  onDragStart: (bookmarkId: string) => void;
  onDragEnd: () => void;
  onDragOver: (bookmarkId: string) => void;
  onDrop: (bookmarkId: string) => void;
  onEdit: (bookmark: BookmarkItem) => void;
  onDelete: (bookmark: BookmarkItem) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const openBookmark = () => window.open(bookmark.url, "_blank", "noopener,noreferrer");

  return (
    <Card
      className={cn(
        "group relative min-h-[120px] rounded-lg border border-[var(--border-subtle)] bg-white py-3 shadow-none transition",
        dragging ? "cursor-grabbing opacity-60" : "cursor-grab hover:border-[var(--color-brand)] hover:bg-white",
        dragOver && "border-[var(--color-brand)] bg-indigo-50/60 ring-2 ring-[var(--color-brand)]/25"
      )}
      draggable={!mutationsDisabled}
      role="link"
      tabIndex={0}
      onClick={openBookmark}
      onDragStart={(event) => {
        event.stopPropagation();
        onDragStart(bookmark.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(bookmark.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop(bookmark.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") openBookmark();
      }}
    >
      <CardHeader className="px-4 pb-0">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[#F8FAFC]">
            <Favicon url={bookmark.url} />
          </div>
          <div className="min-w-0 w-0 flex-1 space-y-1">
            <span className="block truncate text-base font-bold text-[var(--text-heading)]">{bookmark.title}</span>
            <p aria-label={bookmark.url} className="line-clamp-1 break-all text-xs leading-5 text-[var(--text-muted)]">
              <span aria-hidden="true">{bookmarkHost(bookmark.url)}</span>
            </p>
          </div>
          <div className="-mr-1 -mt-1 hidden items-center gap-1 lg:flex" onClick={(event) => event.stopPropagation()}>
            <span className="flex h-6 w-5 cursor-grab items-center justify-center text-[var(--text-muted)]/70 active:cursor-grabbing" title="드래그해서 위치 변경">
              <GripVertical className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{bookmark.title} 위치 변경</span>
            </span>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <Button variant="ghost" size="icon-xs" disabled={mutationsDisabled} onClick={() => onEdit(bookmark)}>
                <Pencil className="h-4 w-4" />
                <span className="sr-only">{bookmark.title} 편집</span>
              </Button>
              <Button variant="ghost" size="icon-xs" disabled={mutationsDisabled} onClick={() => onDelete(bookmark)}>
                <Trash2 className="h-4 w-4 text-destructive" />
                <span className="sr-only">{bookmark.title} 삭제</span>
              </Button>
            </div>
          </div>
          <details
            className="relative -mr-2 -mt-2 shrink-0 lg:hidden"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onToggle={(event) => setMobileActionsOpen(event.currentTarget.open)}
          >
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded text-[var(--text-muted)] outline-none hover:bg-[#F8FAFC] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50 [&::-webkit-details-marker]:hidden">
              <MoreHorizontal className="h-5 w-5" />
              <span className="sr-only">{bookmark.title} 메뉴</span>
            </summary>
            <div hidden={!mobileActionsOpen} className="absolute right-0 z-10 mt-1 w-28 rounded-lg border border-[var(--border-subtle)] bg-white p-1 shadow-lg">
              <button
                type="button"
                disabled={mutationsDisabled}
                className="flex h-10 w-full items-center gap-2 rounded px-3 text-left text-sm font-medium text-[var(--text-heading)] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => onEdit(bookmark)}
              >
                <Pencil className="h-4 w-4" />
                편집
              </button>
              <button
                type="button"
                disabled={mutationsDisabled}
                className="flex h-10 w-full items-center gap-2 rounded px-3 text-left text-sm font-medium text-destructive hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => onDelete(bookmark)}
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </button>
            </div>
          </details>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-2 px-4 pt-1">
        {bookmark.description ? <p className="line-clamp-1 text-xs leading-5 text-[var(--text-muted)]">{bookmark.description}</p> : null}
        <div className="mt-auto flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1 overflow-hidden">
            {folder ? <Badge variant="secondary">{folder.name}</Badge> : null}
            {section ? <Badge variant="outline">{section.name}</Badge> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={mutationsDisabled}
              className="h-10 w-10 border border-[var(--border-subtle)] bg-[#F8FAFC]"
              onClick={() => onToggleFavorite(bookmark.id)}
            >
              <Star className={cn("h-4 w-4", bookmark.isFavorite ? "fill-[var(--color-brand)] text-[var(--color-brand)]" : "text-[var(--text-muted)]")} />
              <span className="sr-only">{bookmark.title} 즐겨찾기</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-10 w-10 border border-[var(--border-subtle)] bg-[#F8FAFC]"
              onClick={openBookmark}
            >
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">{bookmark.title} 열기</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);

  if (!safeUrl(url) || failed) {
    return <Globe className="h-4 w-4 text-[var(--text-muted)]" />;
  }

  return (
    <span className="relative flex h-[18px] w-[18px] items-center justify-center">
      {!loaded ? <Globe className="h-4 w-4 text-[var(--text-muted)]" /> : null}
      <img
        src={`/api/favicon?url=${encodeURIComponent(url)}&size=32`}
        alt=""
        width={18}
        height={18}
        draggable={false}
        className={cn("absolute inset-0 h-[18px] w-[18px] rounded-sm", loaded ? "opacity-100" : "opacity-0")}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function Modal({ title, children, onClose, closeDisabled = false }: { title: string; children: React.ReactNode; onClose: () => void; closeDisabled?: boolean }) {
  const titleId = useId();

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !closeDisabled) onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeDisabled, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="max-h-[calc(100dvh-env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-[var(--border-subtle)] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-lg sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <h2 id={titleId} className="min-w-0 flex-1 text-lg font-bold text-[var(--text-heading)]">
            {title}
          </h2>
          <button type="button" disabled={closeDisabled} className="rounded p-1 text-[var(--text-muted)] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40" onClick={onClose}>
            <X className="h-5 w-5" />
            <span className="sr-only">닫기</span>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function DatabaseProgressStatus({ title }: { title: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg border border-[var(--color-brand)]/30 bg-indigo-50 px-4 py-3">
      <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-[var(--color-brand)]" />
      <div>
        <p className="text-sm font-bold text-[var(--text-heading)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">완료될 때까지 잠시 기다려 주세요.</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-[var(--text-heading)]">{label}</span>
      {children}
    </label>
  );
}
