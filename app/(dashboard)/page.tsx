"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Menu, Plus, Search, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookmarkCard } from "@/app/(dashboard)/bookmarks-ui/BookmarkCard";
import { BookmarksLoading } from "@/app/(dashboard)/bookmarks-ui/BookmarksLoading";
import { DatabaseProgressStatus } from "@/app/(dashboard)/bookmarks-ui/DatabaseProgressStatus";
import { Field } from "@/app/(dashboard)/bookmarks-ui/Field";
import { Modal } from "@/app/(dashboard)/bookmarks-ui/Modal";
import { SectionActionsMenu } from "@/app/(dashboard)/bookmarks-ui/SectionActionsMenu";
import { readBookmarkCache, writeBookmarkCache } from "@/app/lib/bookmarks/cache";
import { apiRequest } from "@/app/lib/bookmarks/client-api";
import {
  BOOKMARK_APP_HEADER_CLASS,
  BOOKMARK_SECTION_HEADER_CLASS,
  BOOKMARK_TOUCH_TARGET_CLASS,
  COLOR_FALLBACK,
  COLOR_OPTIONS,
  NO_SECTION,
  ROOT_FOLDER,
  STORAGE_KEY
} from "@/app/lib/bookmarks/constants";
import { countBookmarks, matchesBookmarkFilters } from "@/app/lib/bookmarks/counts";
import { ConsoleSidebar } from "@/app/(dashboard)/ConsoleSidebar";
import {
  flattenFolderTree,
  flattenFolderResponse,
  folderDescendantIds,
  folderParentId,
  normalizeFolderPositions
} from "@/app/lib/bookmarks/folder-tree";
import { buildBookmarkGroups, visibleFoldersInSubtree } from "@/app/lib/bookmarks/groups";
import {
  applyPositions,
  createId,
  getPositionChanges,
  moveById,
  normalizePositions,
  updateMatchingPositions
} from "@/app/lib/bookmarks/positions";
import { INITIAL_BOOKMARKS, INITIAL_FOLDERS, INITIAL_SECTIONS } from "@/app/lib/bookmarks/sample-data";
import { findSectionByName } from "@/app/lib/bookmarks/sections";
import type { BookmarkItem, Folder, FolderTreeItem, Section } from "@/app/lib/bookmarks/types";
import { safeUrl } from "@/app/lib/bookmarks/url";
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
  const [folderDraft, setFolderDraft] = useState({ name: "", color: COLOR_OPTIONS[0], parentId: ROOT_FOLDER });
  const [folderError, setFolderError] = useState("");
  const [sectionDialog, setSectionDialog] = useState<SectionDialog | null>(null);
  const [sectionDraft, setSectionDraft] = useState<{ name: string; color: string | null; folderId: string }>({
    name: "",
    color: null,
    folderId: ""
  });
  const [sectionColorDraft, setSectionColorDraft] = useState<string | null>(null);
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
    writeBookmarkCache({
      version: 2,
      apiBacked,
      savedAt: Date.now(),
      folders,
      sections,
      bookmarks,
      selectedFolderId
    });
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

  const orderedFolderNodes = useMemo(() => flattenFolderTree(folders), [folders]);
  const orderedFolders = useMemo(() => orderedFolderNodes.map((node) => node.folder), [orderedFolderNodes]);
  const selectedFolder = orderedFolders.find((folder) => folder.id === selectedFolderId) ?? orderedFolders[0] ?? null;
  const visibleFolderIds = useMemo(
    () => (selectedFolder ? new Set([selectedFolder.id, ...folderDescendantIds(folders, selectedFolder.id)]) : new Set<string>()),
    [folders, selectedFolder]
  );
  const visibleFolders = useMemo(() => {
    if (!selectedFolder) return [];
    return visibleFoldersInSubtree(folders, selectedFolder, visibleFolderIds);
  }, [folders, selectedFolder, visibleFolderIds]);

  useEffect(() => {
    if (selectedFolderId && folders.some((folder) => folder.id === selectedFolderId)) return;
    setSelectedFolderId(folders[0]?.id ?? "");
  }, [folders, selectedFolderId]);

  const filtered = useMemo(() => {
    if (!selectedFolder) return [];
    return bookmarks
      .filter(
        (bookmark) =>
          visibleFolderIds.has(bookmark.folderId ?? "") && matchesBookmarkFilters(bookmark, { favoriteOnly, query })
      )
      .sort((a, b) => a.position - b.position);
  }, [bookmarks, favoriteOnly, query, selectedFolder, visibleFolderIds]);

  const hasActiveFilter = favoriteOnly || query.trim().length > 0;

  const groups = useMemo(
    () => buildBookmarkGroups(filtered, visibleFolders, sections, hasActiveFilter),
    [filtered, hasActiveFilter, sections, visibleFolders]
  );

  const currentFolderBookmarks = bookmarks.filter((bookmark) => visibleFolderIds.has(bookmark.folderId ?? ""));
  const currentFavoriteCount = countBookmarks(currentFolderBookmarks, { favoriteOnly: true });
  const currentCount = hasActiveFilter ? filtered.length : currentFolderBookmarks.length;
  const emptyMessage = query ? "검색 결과가 없습니다." : favoriteOnly ? "즐겨찾기한 북마크가 없습니다." : "북마크가 없습니다.";
  const folderSections = sections
    .filter((section) => section.folderId === bookmarkDraft.folderId)
    .sort((a, b) => a.position - b.position);
  const parentFolderOptions = folderDialog?.mode === "edit"
    ? orderedFolderNodes.filter(({ folder }) => {
        const blocked = folderDescendantIds(folders, folderDialog.folderId);
        return folder.id !== folderDialog.folderId && !blocked.has(folder.id);
      })
    : orderedFolderNodes;

  function selectFolder(folderId: string) {
    setSelectedFolderId(folderId);
    if (!folders.some((folder) => folder.id !== folderId && folderParentId(folder) === folderId)) {
      setMobileFoldersOpen(false);
    }
  }

  function requestFolderDelete(folder: Folder) {
    if (folders.some((item) => folderParentId(item) === folder.id)) {
      setMutationError("하위 폴더를 먼저 이동하거나 삭제하세요.");
      return;
    }
    setDeleteTarget({ type: "folder", id: folder.id });
  }

  function openBookmarkDialog(bookmark?: BookmarkItem, target?: { folderId: string; sectionId: string }) {
    if (bootstrapping) return;
    setBookmarkError("");
    setSectionCreatorOpen(false);
    setSectionNameDraft("");
    setSectionColorDraft(null);
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

    const folderId = target?.folderId ?? selectedFolder?.id ?? orderedFolders[0]?.id ?? "";
    setBookmarkDialog({ mode: "create" });
    setBookmarkDraft({
      ...emptyBookmarkDraft(folderId),
      sectionId: target?.sectionId ?? NO_SECTION
    });
  }

  function openFolderDialog(folder?: Folder, parentId: string | null = null) {
    if (bootstrapping) return;
    setFolderError("");
    if (folder) {
      setFolderDialog({ mode: "edit", folderId: folder.id });
      setFolderDraft({
        name: folder.name,
        color: folder.color ?? COLOR_FALLBACK,
        parentId: folderParentId(folder) ?? ROOT_FOLDER
      });
      return;
    }
    setFolderDialog({ mode: "create" });
    setFolderDraft({
      name: "",
      color: COLOR_OPTIONS[folders.length % COLOR_OPTIONS.length],
      parentId: parentId ?? ROOT_FOLDER
    });
  }

  function openSectionDialog(section: Section) {
    if (bootstrapping) return;
    setSectionError("");
    setSectionDialog({ sectionId: section.id });
    setSectionDraft({ name: section.name, color: section.color ?? null, folderId: section.folderId });
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
            body: JSON.stringify({ folderId: bookmarkDraft.folderId, name, color: sectionColorDraft })
          })
        : {
            id: createId("section"),
            name,
            color: sectionColorDraft,
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
    if (!folders.some((folder) => folder.id === sectionDraft.folderId)) {
      setSectionError("이동할 폴더를 선택하세요.");
      return;
    }

    const existingSection = sections.find((section) => section.id === sectionDialog.sectionId);
    const moved = existingSection?.folderId !== sectionDraft.folderId;
    const payload: { name?: string; color?: string | null; folderId?: string } = {};
    if (existingSection?.name !== name) payload.name = name;
    if ((existingSection?.color ?? null) !== sectionDraft.color) {
      payload.color = sectionDraft.color;
    }
    if (moved) payload.folderId = sectionDraft.folderId;

    if (apiBacked && Object.keys(payload).length === 0) {
      setSectionDialog(null);
      return;
    }

    setSectionError("");
    setSaving(true);
    try {
      if (apiBacked) {
        const updated = await apiRequest<Section>(`/api/sections/${sectionDialog.sectionId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        setSections((current) => current.map((section) => (section.id === updated.id ? updated : section)));
        if (moved) {
          setBookmarks((current) =>
            current.map((bookmark) =>
              bookmark.sectionId === updated.id ? { ...bookmark, folderId: updated.folderId } : bookmark
            )
          );
        }
      } else {
        const nextPosition = moved
          ? sections.filter((section) => section.id !== sectionDialog.sectionId && section.folderId === sectionDraft.folderId).length
          : existingSection?.position ?? 0;
        setSections((current) =>
          current.map((section) =>
            section.id === sectionDialog.sectionId
              ? { ...section, name, color: sectionDraft.color, folderId: sectionDraft.folderId, position: nextPosition }
              : section
          )
        );
        if (moved) {
          setBookmarks((current) =>
            current.map((bookmark) =>
              bookmark.sectionId === sectionDialog.sectionId ? { ...bookmark, folderId: sectionDraft.folderId } : bookmark
            )
          );
        }
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
    if (bootstrapping || !draggingSectionId) return;
    const active = sections.find((section) => section.id === draggingSectionId);
    const target = sections.find((section) => section.id === targetSectionId);
    if (!active || !target || !visibleFolderIds.has(active.folderId) || active.folderId !== target.folderId) {
      setDraggingSectionId(null);
      setDragOverSectionId(null);
      return;
    }
    const scoped = sections.filter((section) => section.folderId === active.folderId).sort((a, b) => a.position - b.position);
    const moved = moveById(scoped, draggingSectionId, targetSectionId);
    const changes = getPositionChanges(scoped, moved);
    if (!changes.length) {
      setDraggingSectionId(null);
      setDragOverSectionId(null);
      return;
    }
    void persistOptimisticMutation(
      `reorder:sections:${active.folderId}`,
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
    if (bootstrapping || !draggingBookmarkId) return;
    const active = bookmarks.find((bookmark) => bookmark.id === draggingBookmarkId);
    const target = bookmarks.find((bookmark) => bookmark.id === targetBookmarkId);
    if (
      !active ||
      !target ||
      !visibleFolderIds.has(active.folderId ?? "") ||
      active.folderId !== target.folderId ||
      active.sectionId !== target.sectionId
    ) {
      setDraggingBookmarkId(null);
      setDragOverBookmarkId(null);
      return;
    }
    const scoped = bookmarks
      .filter((bookmark) => bookmark.folderId === active.folderId && bookmark.sectionId === active.sectionId)
      .sort((a, b) => a.position - b.position);
    const moved = moveById(scoped, draggingBookmarkId, targetBookmarkId);
    const changes = getPositionChanges(scoped, moved);
    void persistOptimisticMutation(
      `reorder:bookmarks:${active.folderId}:${active.sectionId ?? NO_SECTION}`,
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
              <span
                data-folder-color={selectedFolder?.color ?? COLOR_FALLBACK}
                aria-hidden="true"
                className="h-5 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: selectedFolder?.color ?? COLOR_FALLBACK }}
              />
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
            <span
              data-folder-color={selectedFolder?.color ?? COLOR_FALLBACK}
              aria-hidden="true"
              className="h-5 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: selectedFolder?.color ?? COLOR_FALLBACK }}
            />
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
              <div role="alert" className="break-words rounded-lg border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-bold text-destructive">
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
                <section key={group.key} className="space-y-3">
                  <div
                    draggable={!bootstrapping && Boolean(group.section)}
                    onDragStart={() => {
                      if (!bootstrapping && group.section) setDraggingSectionId(group.section.id);
                    }}
                    onDragEnd={() => {
                      setDraggingSectionId(null);
                      setDragOverSectionId(null);
                    }}
                    onDragOver={(event) => {
                      const active = sections.find((section) => section.id === draggingSectionId);
                      if (!group.section || !active || active.folderId !== group.folder.id) return;
                      event.preventDefault();
                      setDragOverSectionId(group.section.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggingSectionId && group.section) dropSection(group.section.id);
                    }}
                    className={cn(
                      BOOKMARK_SECTION_HEADER_CLASS,
                      dragOverSectionId === group.section?.id && "border-[var(--color-brand)] bg-indigo-50/60 ring-2 ring-[var(--color-brand)]/25",
                      draggingSectionId === group.section?.id && "opacity-60"
                    )}
                  >
                    <span
                      data-section-color={group.section?.color ?? group.folder.color ?? COLOR_FALLBACK}
                      aria-hidden="true"
                      className="h-6 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: group.section?.color ?? group.folder.color ?? COLOR_FALLBACK }}
                    />
                    <h2 className="min-w-0 flex-1 truncate text-lg font-bold leading-snug text-[var(--text-heading)]">{group.label}</h2>
                    <span className="shrink-0 rounded border border-[var(--border-subtle)] bg-[#F8FAFC] px-2 py-1 text-xs tabular-nums text-[var(--text-muted)]">
                      {group.items.length}
                    </span>
                    {group.section ? (
                      <SectionActionsMenu
                        section={group.section}
                        folder={group.folder}
                        label={group.label}
                        mutationsDisabled={bootstrapping}
                        onAddBookmark={(section, folder) => openBookmarkDialog(undefined, {
                          folderId: folder.id,
                          sectionId: section.id
                        })}
                        onEdit={openSectionDialog}
                        onDelete={(section) => setDeleteTarget({ type: "section", id: section.id })}
                      />
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4" aria-label={`${group.label} 북마크, 드래그해서 위치 변경`}>
                    {group.items.map((bookmark) => (
                      <BookmarkCard
                        key={bookmark.id}
                        bookmark={bookmark}
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
                    setSectionColorDraft(null);
                    setSectionCreateMessage("");
                  }}
                >
                  <SelectTrigger aria-label="폴더" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {orderedFolderNodes.map(({ folder, depth }) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        <span className="block min-w-0 truncate" style={{ paddingLeft: `${Math.max(depth - 1, 0) * 12}px` }}>
                          {folder.name}
                        </span>
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
                  <Field label="색상">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label="폴더 색상 사용"
                        onClick={() => setSectionColorDraft(null)}
                        className={cn(
                          "h-8 rounded border border-[var(--border-subtle)] px-2 text-xs font-medium text-[var(--text-secondary)]",
                          sectionColorDraft === null && "ring-2 ring-[var(--color-brand)] ring-offset-2"
                        )}
                      >
                        기본
                      </button>
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`색상 ${color}`}
                          onClick={() => setSectionColorDraft(color)}
                          className={cn(
                            "h-8 w-8 rounded border border-[var(--border-subtle)]",
                            sectionColorDraft === color && "ring-2 ring-[var(--color-brand)] ring-offset-2"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
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
                        setSectionColorDraft(null);
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
              {sectionCreateMessage ? <p role="status" className="break-words text-xs font-medium text-[var(--text-muted)]">{sectionCreateMessage}</p> : null}
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
            {bookmarkError ? <p className="break-words text-sm font-bold text-destructive">{bookmarkError}</p> : null}
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
                  {parentFolderOptions.map(({ folder, depth }) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <span className="block min-w-0 truncate" style={{ paddingLeft: `${Math.max(depth - 1, 0) * 12}px` }}>
                        {folder.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="색상">
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
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
            {folderError ? <p className="break-words text-sm font-bold text-destructive">{folderError}</p> : null}
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
              <Input value={sectionDraft.name} onChange={(event) => setSectionDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="섹션 이름" />
            </Field>
            <Field label="폴더">
              <Select value={sectionDraft.folderId} onValueChange={(folderId) => setSectionDraft((draft) => ({ ...draft, folderId }))}>
                <SelectTrigger aria-label="폴더" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderedFolderNodes.map(({ folder, depth }) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <span className="block min-w-0 truncate" style={{ paddingLeft: `${Math.max(depth - 1, 0) * 12}px` }}>
                        {folder.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="block text-xs text-[var(--text-muted)]">폴더를 바꾸면 포함된 북마크도 함께 이동합니다.</span>
            </Field>
            <Field label="색상">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-label="폴더 색상 사용"
                  onClick={() => setSectionDraft((draft) => ({ ...draft, color: null }))}
                  className={cn(
                    "h-8 rounded border border-[var(--border-subtle)] px-2 text-xs font-medium text-[var(--text-secondary)]",
                    sectionDraft.color === null && "ring-2 ring-[var(--color-brand)] ring-offset-2"
                  )}
                >
                  기본
                </button>
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`색상 ${color}`}
                    onClick={() => setSectionDraft((draft) => ({ ...draft, color }))}
                    className={cn(
                      "h-8 w-8 rounded border border-[var(--border-subtle)]",
                      sectionDraft.color === color && "ring-2 ring-[var(--color-brand)] ring-offset-2"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </Field>
            {saving ? <DatabaseProgressStatus title="데이터베이스에 저장 중" /> : null}
            {sectionError ? <p className="break-words text-sm font-bold text-destructive">{sectionError}</p> : null}
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
          onConfirm={() => void confirmDelete()}
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
          {deleteError ? <p className="mt-4 break-words text-sm font-bold text-destructive">{deleteError}</p> : null}
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

