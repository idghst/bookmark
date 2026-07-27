"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import {
  Bookmark,
  ExternalLink,
  FolderPlus,
  Grid2X2,
  Globe,
  GripVertical,
  List,
  LoaderCircle,
  Menu,
  Pencil,
  Plus,
  RefreshCcw,
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
import { DashboardAccountMenu } from "@/app/(dashboard)/DashboardAccountMenu";
import { BRAND } from "@/app/lib/config/brand";
import { findSectionByName } from "@/app/lib/bookmarks/sections";
import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";
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

type DeleteTarget =
  | { type: "bookmark"; id: string }
  | { type: "section"; id: string }
  | { type: "folder"; id: string };

type ViewMode = "list" | "grid";

type BookmarkCache = {
  version: 1;
  apiBacked: boolean;
  savedAt: number;
  folders: Folder[];
  sections: Section[];
  bookmarks: BookmarkItem[];
  selectedFolderId?: string;
};

const STORAGE_KEY = "bookmark-cache";
const NO_SECTION = "__none__";
const FOLDER_COLORS = ["#4f46e5", "#2166d7", "#16a34a", "#d97706", "#db2777", "#797979"];
const FOLDER_COLOR_FALLBACK = "#797979";
const BOOKMARK_APP_HEADER_CLASS = "min-h-[var(--dashboard-header-height)] lg:h-[var(--dashboard-header-height)]";
const BOOKMARK_SECTION_HEADER_CLASS =
  "flex h-14 items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-white px-5 transition";

const INITIAL_FOLDERS: Folder[] = [
  { id: "work", name: "작업", color: "#4f46e5", position: 0 },
  { id: "docs", name: "문서", color: "#2166d7", position: 1 },
  { id: "tools", name: "도구", color: "#16a34a", position: 2 },
  { id: "reference", name: "참고", color: "#797979", position: 3 }
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

function folderColor(value: string | null) {
  if (!value) return FOLDER_COLOR_FALLBACK;
  return value.startsWith("--") ? `var(${value})` : value;
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
  const [viewMode, setViewMode] = useState<ViewMode>("list");
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
  const [folderDraft, setFolderDraft] = useState({ name: "", color: FOLDER_COLORS[0] });
  const [folderError, setFolderError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [apiBacked, setApiBacked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (deleteTarget) setDeleteError("");
  }, [deleteTarget]);

  useEffect(() => {
    let cancelled = false;

    function hydrateFromFallback() {
      try {
        const cache = readBookmarkCache();
        if (cache?.folders?.length) {
          setFolders(normalizePositions(cache.folders));
          setSections(normalizePositions(cache.sections ?? []));
          setBookmarks(normalizePositions(cache.bookmarks ?? []));
          setSelectedFolderId(cache.selectedFolderId ?? cache.folders[0].id);
          setApiBacked(Boolean(cache.apiBacked));
          return true;
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      return false;
    }

    async function loadBookmarks() {
      if (hydrateFromFallback()) {
        setHydrated(true);
        return;
      }

      await refreshBookmarks({ fallbackToInitial: true, markHydrated: true, isCancelled: () => cancelled });
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
        version: 1,
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
    isCancelled = () => false
  }: {
    fallbackToInitial?: boolean;
    markHydrated?: boolean;
    isCancelled?: () => boolean;
  } = {}) {
    setRefreshing(true);
    try {
      const [remoteFolders, remoteSections, remoteBookmarks] = await Promise.all([
        apiRequest<Folder[]>("/api/folders"),
        apiRequest<Section[]>("/api/sections"),
        apiRequest<BookmarkItem[]>("/api/bookmarks")
      ]);
      if (isCancelled()) return;
      if (!remoteFolders.length) throw new Error("폴더 데이터가 없습니다.");
      setFolders(remoteFolders);
      setSections(remoteSections);
      setBookmarks(remoteBookmarks);
      setSelectedFolderId((current) => (remoteFolders.some((folder) => folder.id === current) ? current : remoteFolders[0].id));
      setApiBacked(true);
    } catch {
      if (!fallbackToInitial || isCancelled()) return;
      setFolders(INITIAL_FOLDERS);
      setSections(INITIAL_SECTIONS);
      setBookmarks(INITIAL_BOOKMARKS);
      setSelectedFolderId(INITIAL_FOLDERS[0]?.id ?? "");
      setApiBacked(false);
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
      return items.length ? [{ id: section.id, label: section.name, items }] : [];
    });
    const unassigned = bySection.get(null) ?? [];
    return unassigned.length ? [...sectionGroups, { id: NO_SECTION, label: "섹션 없음", items: unassigned }] : sectionGroups;
  }, [filtered, sections, selectedFolder]);

  const currentFolderBookmarks = selectedFolder
    ? bookmarks.filter((bookmark) => bookmark.folderId === selectedFolder.id)
    : [];
  const hasActiveFilter = favoriteOnly || query.trim().length > 0;
  const currentFavoriteCount = countBookmarks(currentFolderBookmarks, { favoriteOnly: true });
  const currentCount = hasActiveFilter ? filtered.length : currentFolderBookmarks.length;
  const emptyMessage = query ? "검색 결과가 없습니다." : favoriteOnly ? "즐겨찾기한 북마크가 없습니다." : "북마크가 없습니다.";
  const getFolderVisibleCount = (folderId: string) => countBookmarks(bookmarks, { folderId, favoriteOnly });
  const folderSections = sections
    .filter((section) => section.folderId === bookmarkDraft.folderId)
    .sort((a, b) => a.position - b.position);

  function selectFolder(folderId: string) {
    setSelectedFolderId(folderId);
    setMobileFoldersOpen(false);
  }

  function openBookmarkDialog(bookmark?: BookmarkItem) {
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

  function openFolderDialog(folder?: Folder) {
    setFolderError("");
    if (folder) {
      setFolderDialog({ mode: "edit", folderId: folder.id });
      setFolderDraft({ name: folder.name, color: folder.color ?? FOLDER_COLOR_FALLBACK });
      return;
    }
    setFolderDialog({ mode: "create" });
    setFolderDraft({ name: "", color: FOLDER_COLORS[folders.length % FOLDER_COLORS.length] });
  }

  async function createSectionFromBookmarkDialog() {
    if (creatingSection) return;
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
    if (saving || creatingSection) return;
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
    if (saving) return;
    const name = folderDraft.name.trim();
    if (!name) {
      setFolderError("폴더 이름을 입력하세요.");
      return;
    }

    setFolderError("");
    setSaving(true);
    try {
      if (folderDialog?.mode === "edit") {
        if (apiBacked) {
          const updated = await apiRequest<Folder>(`/api/folders/${folderDialog.folderId}`, {
            method: "PATCH",
            body: JSON.stringify({ name, color: folderDraft.color })
          });
          setFolders((current) => current.map((folder) => (folder.id === updated.id ? updated : folder)));
        } else {
          setFolders((current) =>
            current.map((folder) => (folder.id === folderDialog.folderId ? { ...folder, name, color: folderDraft.color } : folder))
          );
        }
      } else {
        const folder = apiBacked
          ? await apiRequest<Folder>("/api/folders", {
              method: "POST",
              body: JSON.stringify({ name, color: folderDraft.color })
            })
          : {
              id: createId("folder"),
              name,
              color: folderDraft.color,
              position: folders.length
            };
        setFolders((current) => [...current, folder]);
        setSelectedFolderId(folder.id);
      }

      setFolderDialog(null);
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "폴더 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;

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

      const fallbackFolderId = folders.find((folder) => folder.id !== deleteTarget.id)?.id ?? "";
      if (apiBacked) {
        await apiRequest<void>(`/api/folders/${deleteTarget.id}`, { method: "DELETE" });
      }
      setFolders((current) => normalizePositions(current.filter((folder) => folder.id !== deleteTarget.id)));
      setSections((current) => normalizePositions(current.filter((section) => section.folderId !== deleteTarget.id)));
      setBookmarks((current) =>
        current.map((bookmark) =>
          bookmark.folderId === deleteTarget.id
            ? { ...bookmark, folderId: fallbackFolderId, sectionId: null }
            : bookmark
        )
      );
      if (selectedFolderId === deleteTarget.id) setSelectedFolderId(fallbackFolderId);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  async function persistOptimisticMutation(
    apply: () => void,
    rollback: () => void,
    request: () => Promise<unknown>,
    fallbackMessage: string
  ) {
    setMutationError("");
    apply();
    if (!apiBacked) return;

    try {
      await request();
    } catch (error) {
      rollback();
      setMutationError(error instanceof Error ? error.message : fallbackMessage);
    }
  }

  function toggleFavorite(id: string) {
    const bookmark = bookmarks.find((item) => item.id === id);
    if (!bookmark) return;
    const previous = bookmarks;
    const next = bookmarks.map((item) =>
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    );
    void persistOptimisticMutation(
      () => setBookmarks(next),
      () => setBookmarks(previous),
      () =>
        apiRequest<BookmarkItem>(`/api/bookmarks/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ isFavorite: !bookmark.isFavorite })
        }),
      "즐겨찾기 변경에 실패했습니다."
    );
  }

  function dropFolder(targetFolderId: string) {
    if (!draggingFolderId) return;
    const previous = folders;
    const moved = moveById(orderedFolders, draggingFolderId, targetFolderId);
    void persistOptimisticMutation(
      () => setFolders(moved),
      () => setFolders(previous),
      () => apiRequest<void>("/api/folders/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
      "폴더 순서 저장에 실패했습니다."
    );
    setDraggingFolderId(null);
    setDragOverFolderId(null);
  }

  function dropSection(targetSectionId: string) {
    if (!selectedFolder || !draggingSectionId) return;
    const scoped = sections.filter((section) => section.folderId === selectedFolder.id).sort((a, b) => a.position - b.position);
    const moved = moveById(scoped, draggingSectionId, targetSectionId);
    const previous = sections;
    const next = sections.map((section) => moved.find((item) => item.id === section.id) ?? section);
    void persistOptimisticMutation(
      () => setSections(next),
      () => setSections(previous),
      () => apiRequest<void>("/api/sections/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
      "섹션 순서 저장에 실패했습니다."
    );
    setDraggingSectionId(null);
    setDragOverSectionId(null);
  }

  function dropBookmark(targetBookmarkId: string) {
    if (!selectedFolder || !draggingBookmarkId) return;
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
    const previous = bookmarks;
    const next = bookmarks.map((bookmark) => moved.find((item) => item.id === bookmark.id) ?? bookmark);
    void persistOptimisticMutation(
      () => setBookmarks(next),
      () => setBookmarks(previous),
      () => apiRequest<void>("/api/bookmarks/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
      "북마크 순서 저장에 실패했습니다."
    );
    setDraggingBookmarkId(null);
    setDragOverBookmarkId(null);
  }

  function dragOverBookmark(targetBookmarkId: string) {
    const active = bookmarks.find((bookmark) => bookmark.id === draggingBookmarkId);
    const target = bookmarks.find((bookmark) => bookmark.id === targetBookmarkId);
    setDragOverBookmarkId(active?.folderId === target?.folderId && active?.sectionId === target?.sectionId ? targetBookmarkId : null);
  }

  if (!hydrated) {
    return <BookmarksLoading />;
  }

  return (
    <div className="fade-in flex h-full min-h-[640px] overflow-hidden bg-white">
      <FolderSidebar
        folders={orderedFolders}
        bookmarks={bookmarks}
        favoriteOnly={favoriteOnly}
        selectedFolderId={selectedFolder?.id ?? ""}
        draggingFolderId={draggingFolderId}
        dragOverFolderId={dragOverFolderId}
        onSelectFolder={selectFolder}
        onAddFolder={() => openFolderDialog()}
        onEditFolder={openFolderDialog}
        onDeleteFolder={(folder) => setDeleteTarget({ type: "folder", id: folder.id })}
        onRefresh={() => void refreshBookmarks()}
        refreshing={refreshing}
        onDragFolder={(id) => {
          setDraggingFolderId(id);
          if (!id) setDragOverFolderId(null);
        }}
        onDragOverFolder={setDragOverFolderId}
        onDropFolder={dropFolder}
        className="hidden lg:flex"
      />

      {mobileFoldersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="폴더 메뉴 닫기"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileFoldersOpen(false)}
          />
          <FolderSidebar
            folders={orderedFolders}
            bookmarks={bookmarks}
            favoriteOnly={favoriteOnly}
            selectedFolderId={selectedFolder?.id ?? ""}
            draggingFolderId={draggingFolderId}
            dragOverFolderId={dragOverFolderId}
            onSelectFolder={selectFolder}
            onAddFolder={() => openFolderDialog()}
            onEditFolder={openFolderDialog}
            onDeleteFolder={(folder) => setDeleteTarget({ type: "folder", id: folder.id })}
            onRefresh={() => void refreshBookmarks()}
            refreshing={refreshing}
            onDragFolder={(id) => {
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
          className={cn(
            "grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border-subtle)] bg-white px-4 md:px-5",
            BOOKMARK_APP_HEADER_CLASS
          )}
        >
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileFoldersOpen(true)}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">폴더 메뉴 열기</span>
          </Button>
          <div className="hidden min-w-0 items-center gap-2 md:flex">
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
              className="h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[#F8FAFC] pl-11 pr-11 text-sm outline-none transition focus:border-[var(--color-brand)] focus:bg-white"
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
            <div className="hidden rounded-lg border border-[var(--border-subtle)] bg-[#F8FAFC] p-0.5 sm:flex" aria-label="보기 방식">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon-sm"
                data-template-action-ignore
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
                <span className="sr-only">리스트</span>
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon-sm"
                data-template-action-ignore
                onClick={() => setViewMode("grid")}
              >
                <Grid2X2 className="h-4 w-4" />
                <span className="sr-only">그리드</span>
              </Button>
            </div>
            <Button
              variant={favoriteOnly ? "default" : "outline"}
              size="sm"
              data-template-action-ignore
              onClick={() => setFavoriteOnly((value) => !value)}
              className="hidden sm:inline-flex"
            >
              <Star className={cn("h-4 w-4", favoriteOnly && "fill-current")} />
              즐겨찾기
              <span className="tabular-nums">{currentFavoriteCount}</span>
            </Button>
            <Button size="sm" disabled={!selectedFolder} onClick={() => openBookmarkDialog()} className="hidden sm:inline-flex">
              <Plus className="h-4 w-4" />
              북마크 추가
            </Button>
          </div>
        </header>

        <div className="border-b border-[var(--border-subtle)] bg-[#F8FAFC] px-4 py-3 lg:hidden">
          <div className="scrollbar-hidden flex gap-2 overflow-x-auto">
            {orderedFolders.map((folder) => (
              <button key={folder.id} type="button" onClick={() => selectFolder(folder.id)}>
                <Badge variant={folder.id === selectedFolder?.id ? "default" : "outline"}>
                  {folder.name}
                  <span className="ml-1 tabular-nums">{getFolderVisibleCount(folder.id)}</span>
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="mx-auto w-full max-w-[1480px] space-y-6 p-4 md:p-6 lg:p-8">
            {mutationError ? (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-bold text-destructive">
                {mutationError}
              </div>
            ) : null}
            {filtered.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white px-6 text-center">
                <div className="mb-3 h-1.5 w-12 rounded-full bg-[var(--color-brand)]" />
                <p className="text-base font-bold text-[var(--text-heading)]">{emptyMessage}</p>
                <Button className="mt-4" size="sm" disabled={!selectedFolder} onClick={() => openBookmarkDialog()}>
                  <Plus className="h-4 w-4" />
                  북마크 추가
                </Button>
              </div>
            ) : (
              groups.map((group) => (
                <section key={group.id} className="space-y-4">
                  <div
                    draggable={group.id !== NO_SECTION}
                    onDragStart={() => {
                      if (group.id !== NO_SECTION) setDraggingSectionId(group.id);
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
                    <span className="h-7 w-1 bg-[var(--color-brand)]" />
                    <h2 className="min-w-0 flex-1 truncate text-2xl font-bold text-[var(--text-heading)]">{group.label}</h2>
                    <span className="rounded border border-[var(--border-subtle)] bg-[#F8FAFC] px-2.5 py-1 text-xs tabular-nums text-[var(--text-muted)]">
                      {group.items.length}
                    </span>
                    {group.id !== NO_SECTION ? (
                      <>
                        <button
                          type="button"
                          className="rounded p-1 text-[var(--text-muted)] hover:bg-red-50 hover:text-destructive"
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
                          draggable
                          className="rounded p-1 text-[var(--text-muted)] hover:bg-[#F8FAFC]"
                          onDragStart={() => setDraggingSectionId(group.id)}
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
                  <div className={cn("grid grid-cols-1", viewMode === "list" ? "gap-3" : "gap-4 lg:grid-cols-2 2xl:grid-cols-3")}>
                    {group.items.map((bookmark) => (
                      <BookmarkCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        folder={selectedFolder}
                        section={sections.find((section) => section.id === bookmark.sectionId) ?? null}
                        viewMode={viewMode}
                        dragging={draggingBookmarkId === bookmark.id}
                        dragOver={dragOverBookmarkId === bookmark.id}
                        onDragStart={(id) => setDraggingBookmarkId(id)}
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

        <Button size="icon-lg" disabled={!selectedFolder} className="fixed bottom-4 right-4 z-40 sm:hidden" onClick={() => openBookmarkDialog()}>
          <Plus className="h-5 w-5" />
          <span className="sr-only">북마크 추가</span>
        </Button>
      </section>

      {bookmarkDialog ? (
        <Modal title={bookmarkDialog.mode === "edit" ? "북마크 편집" : "북마크 추가"} onClose={() => setBookmarkDialog(null)} closeDisabled={saving || creatingSection}>
          <form className="space-y-4" onSubmit={saveBookmark} aria-busy={saving || creatingSection}>
            <Field label="URL">
              <Input value={bookmarkDraft.url} onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, url: event.target.value }))} placeholder="https://example.com" />
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
              : "이 폴더를 삭제하고, 안의 북마크는 다른 폴더로 이동합니다."}
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
    <div className="fade-in flex h-full min-h-[640px] overflow-hidden bg-white">
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[#F8FAFC] lg:flex">
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

function FolderSidebar({
  folders,
  bookmarks,
  favoriteOnly,
  selectedFolderId,
  draggingFolderId,
  dragOverFolderId,
  onSelectFolder,
  onAddFolder,
  onEditFolder,
  onDeleteFolder,
  onRefresh,
  refreshing,
  onDragFolder,
  onDragOverFolder,
  onDropFolder,
  className
}: {
  folders: Folder[];
  bookmarks: BookmarkItem[];
  favoriteOnly: boolean;
  selectedFolderId: string;
  draggingFolderId: string | null;
  dragOverFolderId: string | null;
  onSelectFolder: (id: string) => void;
  onAddFolder: () => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onDragFolder: (folderId: string | null) => void;
  onDragOverFolder: (folderId: string | null) => void;
  onDropFolder: (folderId: string) => void;
  className?: string;
}) {
  const visibleBookmarkCount = countBookmarks(bookmarks, { favoriteOnly });

  return (
    <aside className={cn("w-[280px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[#F8FAFC]", className)}>
      <div className={cn("flex shrink-0 flex-col justify-center border-b border-[var(--border-subtle)] px-4 py-3", BOOKMARK_APP_HEADER_CLASS)}>
        <div className="flex items-center gap-2">
          <Link
            href={"/" as Route}
            aria-label={`${BRAND.appName} 홈으로 이동`}
            className="min-w-0 flex-1 truncate rounded text-xl font-bold tracking-tight text-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50"
          >
            {BRAND.appName}
          </Link>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-white text-[var(--text-muted)] transition hover:text-[var(--color-brand)] disabled:opacity-50"
            aria-label="북마크 새로고침"
            title="북마크 새로고침"
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Bookmark className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]" />
          <span className="font-bold text-[var(--text-heading)]">폴더</span>
          <span className="text-[var(--text-muted)]">
            {visibleBookmarkCount.toLocaleString()}개 {favoriteOnly ? "즐겨찾기" : "북마크"}
          </span>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="북마크 폴더">
        <div className="space-y-1">
          {folders.map((folder) => {
            const active = folder.id === selectedFolderId;
            const count = countBookmarks(bookmarks, { folderId: folder.id, favoriteOnly });
            return (
              <div
                key={folder.id}
                draggable
                onDragStart={() => onDragFolder(folder.id)}
                onDragEnd={() => onDragFolder(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  onDragOverFolder(folder.id);
                }}
                onDrop={() => onDropFolder(folder.id)}
                className={cn(
                  "group relative flex items-center rounded transition",
                  draggingFolderId === folder.id && "opacity-60",
                  dragOverFolderId === folder.id && "bg-indigo-50/60 ring-2 ring-[var(--color-brand)]/25"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectFolder(folder.id)}
                  className={cn(
                    "flex min-h-10 flex-1 items-center gap-2.5 rounded border border-transparent px-3 py-2 pr-20 text-sm font-bold transition",
                    active
                      ? "border-l-2 border-l-[var(--color-brand)] border-y-[var(--border-subtle)] border-r-[var(--border-subtle)] bg-white text-[var(--text-heading)]"
                      : "text-[#334155] hover:border-[var(--border-subtle)] hover:bg-white"
                  )}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: folderColor(folder.color) }} />
                  <span className="min-w-0 flex-1 truncate text-left">{folder.name}</span>
                  <span className="text-xs tabular-nums text-[var(--text-muted)]">{count}</span>
                </button>
                <div className="absolute right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                  <GripVertical className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
                  <button className="rounded p-1 text-[var(--text-muted)] hover:bg-[#F8FAFC]" onClick={() => onEditFolder(folder)}>
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">{folder.name} 편집</span>
                  </button>
                  <button className="rounded p-1 text-destructive hover:bg-[#F8FAFC]" onClick={() => onDeleteFolder(folder)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">{folder.name} 삭제</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 space-y-1.5 border-t border-[var(--border-subtle)] p-3">
        <button className="flex min-h-9 w-full items-center gap-2 rounded px-3 text-sm font-bold text-[#334155] hover:bg-white" onClick={onAddFolder}>
          <FolderPlus className="h-4 w-4" />
          새 폴더
        </button>
      </div>
      <DashboardAccountMenu className="mx-3 mb-3" />
    </aside>
  );
}

function BookmarkCard({
  bookmark,
  folder,
  section,
  viewMode,
  dragging,
  dragOver,
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
  viewMode: ViewMode;
  dragging: boolean;
  dragOver: boolean;
  onDragStart: (bookmarkId: string) => void;
  onDragEnd: () => void;
  onDragOver: (bookmarkId: string) => void;
  onDrop: (bookmarkId: string) => void;
  onEdit: (bookmark: BookmarkItem) => void;
  onDelete: (bookmark: BookmarkItem) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const openBookmark = () => window.open(bookmark.url, "_blank", "noopener,noreferrer");

  return (
    <Card
      className={cn(
        "group rounded-lg border border-[var(--border-subtle)] bg-white shadow-none transition",
        viewMode === "list" ? "min-h-[104px]" : "min-h-[132px]",
        dragging ? "opacity-60" : "cursor-pointer hover:border-[var(--color-brand)] hover:bg-white",
        dragOver && "border-[var(--color-brand)] bg-indigo-50/60 ring-2 ring-[var(--color-brand)]/25"
      )}
      draggable
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
      <CardHeader className="px-5 pb-0">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[#F8FAFC]">
            <Favicon url={bookmark.url} />
          </div>
          <div className="min-w-0 w-0 flex-1 space-y-1">
            <span className="block truncate text-base font-bold text-[var(--text-heading)]">{bookmark.title}</span>
            <p className="break-all text-sm leading-5 text-[var(--text-muted)]">{bookmark.url}</p>
          </div>
          <div className="-mr-1 -mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100" onClick={(event) => event.stopPropagation()}>
            <GripVertical className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
            <Button variant="ghost" size="icon-xs" onClick={() => onEdit(bookmark)}>
              <Pencil className="h-4 w-4" />
              <span className="sr-only">{bookmark.title} 편집</span>
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => onDelete(bookmark)}>
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="sr-only">{bookmark.title} 삭제</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3 px-5 pt-1">
        {bookmark.description ? <p className="line-clamp-2 text-sm text-[var(--text-muted)]">{bookmark.description}</p> : null}
        <div className="mt-auto flex min-w-0 items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1 overflow-hidden">
            {folder ? <Badge variant="secondary">{folder.name}</Badge> : null}
            {section ? <Badge variant="outline">{section.name}</Badge> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="icon-xs" className="border border-[var(--border-subtle)] bg-[#F8FAFC]" onClick={() => onToggleFavorite(bookmark.id)}>
              <Star className={cn("h-4 w-4", bookmark.isFavorite ? "fill-[var(--color-brand)] text-[var(--color-brand)]" : "text-[var(--text-muted)]")} />
              <span className="sr-only">{bookmark.title} 즐겨찾기</span>
            </Button>
            <Button variant="ghost" size="icon-xs" className="border border-[var(--border-subtle)] bg-[#F8FAFC]" onClick={openBookmark}>
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-2xl">
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
