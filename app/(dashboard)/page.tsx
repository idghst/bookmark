"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Menu, Plus, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConsoleSidebar } from "@/app/(dashboard)/ConsoleSidebar";
import { BookmarkCard } from "@/app/(dashboard)/bookmarks-ui/BookmarkCard";
import { BookmarksLoading } from "@/app/(dashboard)/bookmarks-ui/BookmarksLoading";
import { DatabaseProgressStatus } from "@/app/(dashboard)/bookmarks-ui/DatabaseProgressStatus";
import { Field } from "@/app/(dashboard)/bookmarks-ui/Field";
import { FolderActionsMenu } from "@/app/(dashboard)/bookmarks-ui/SectionActionsMenu";
import { Modal } from "@/app/(dashboard)/bookmarks-ui/Modal";
import { readBookmarkCache, writeBookmarkCache } from "@/app/lib/bookmarks/cache";
import { apiRequest } from "@/app/lib/bookmarks/client-api";
import {
  BOOKMARK_APP_HEADER_CLASS,
  BOOKMARK_SECTION_HEADER_CLASS,
  BOOKMARK_TOUCH_TARGET_CLASS,
  COLOR_FALLBACK,
  COLOR_OPTIONS,
  NO_SECTION,
  STORAGE_KEY
} from "@/app/lib/bookmarks/constants";
import { countBookmarks, matchesBookmarkFilters } from "@/app/lib/bookmarks/counts";
import { flattenFolderResponse, folderSectionId, normalizeFolderPositions } from "@/app/lib/bookmarks/folder-tree";
import { buildBookmarkGroups } from "@/app/lib/bookmarks/groups";
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
import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";
import { safeUrl } from "@/app/lib/bookmarks/url";
import { cn } from "@/lib/utils";

type Selection = { kind: "folder" | "section"; id: string };
type BookmarkDialog = { mode: "create" | "edit"; bookmarkId?: string };
type FolderDialog = { mode: "create" | "edit"; folderId?: string };
type SectionDialog = { mode: "create" | "edit"; sectionId?: string };
type DeleteTarget = { type: "bookmark" | "folder" | "section"; id: string };

type BookmarkDraft = {
  title: string;
  url: string;
  description: string;
  folderId: string;
  isFavorite: boolean;
};

const emptyBookmarkDraft = (folderId: string): BookmarkDraft => ({
  title: "",
  url: "",
  description: "",
  folderId,
  isFavorite: false
});

export default function BookmarksPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [query, setQuery] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [apiBacked, setApiBacked] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mobileFoldersOpen, setMobileFoldersOpen] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [bookmarkDialog, setBookmarkDialog] = useState<BookmarkDialog | null>(null);
  const [folderDialog, setFolderDialog] = useState<FolderDialog | null>(null);
  const [sectionDialog, setSectionDialog] = useState<SectionDialog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [bookmarkDraft, setBookmarkDraft] = useState(() => emptyBookmarkDraft(INITIAL_FOLDERS[0]?.id ?? ""));
  const [folderDraft, setFolderDraft] = useState<{ name: string; color: string | null; sectionId: string }>({
    name: "",
    color: COLOR_OPTIONS[0],
    sectionId: NO_SECTION
  });
  const [sectionDraft, setSectionDraft] = useState({ name: "", color: null as string | null });
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [draggingBookmarkId, setDraggingBookmarkId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [dragOverBookmarkId, setDragOverBookmarkId] = useState<string | null>(null);
  const mutationQueues = useRef(new Map<string, Promise<void>>());
  const pendingOptimistic = useRef(new Map<symbol, () => void>());

  const orderedSections = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "ko")),
    [sections]
  );
  const orderedFolders = useMemo(
    () => [...folders].sort((a, b) => {
      const sectionA = orderedSections.findIndex((section) => section.id === folderSectionId(a));
      const sectionB = orderedSections.findIndex((section) => section.id === folderSectionId(b));
      return sectionA - sectionB || a.position - b.position || a.name.localeCompare(b.name, "ko");
    }),
    [folders, orderedSections]
  );

  const selectedSection = selection?.kind === "section"
    ? sections.find((section) => section.id === selection.id) ?? null
    : null;
  const selectedFolder = selection?.kind === "folder"
    ? folders.find((folder) => folder.id === selection.id) ?? null
    : null;
  const visibleFolders = useMemo(() => {
    if (selectedFolder) return [selectedFolder];
    if (selectedSection) {
      return orderedFolders.filter((folder) => folderSectionId(folder) === selectedSection.id);
    }
    return [];
  }, [orderedFolders, selectedFolder, selectedSection]);
  const visibleFolderIds = useMemo(() => new Set(visibleFolders.map((folder) => folder.id)), [visibleFolders]);
  const filtered = useMemo(
    () => bookmarks
      .filter((bookmark) => visibleFolderIds.has(bookmark.folderId ?? ""))
      .filter((bookmark) => matchesBookmarkFilters(bookmark, { favoriteOnly, query }))
      .sort((a, b) => a.position - b.position),
    [bookmarks, favoriteOnly, query, visibleFolderIds]
  );
  const hasActiveFilter = favoriteOnly || Boolean(query.trim());
  const groups = useMemo(
    () => buildBookmarkGroups(filtered, visibleFolders, hasActiveFilter),
    [filtered, hasActiveFilter, visibleFolders]
  );
  const visibleBookmarks = bookmarks.filter((bookmark) => visibleFolderIds.has(bookmark.folderId ?? ""));
  const currentCount = hasActiveFilter ? filtered.length : visibleBookmarks.length;
  const favoriteCount = countBookmarks(visibleBookmarks, { favoriteOnly: true });
  const activeName = selectedFolder?.name ?? selectedSection?.name ?? "북마크";
  const activeColor = selectedFolder?.color ?? selectedSection?.color ?? COLOR_FALLBACK;

  useEffect(() => {
    let cancelled = false;
    const cache = (() => {
      try {
        return readBookmarkCache();
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }
    })();
    if (cache) {
      setFolders(normalizeFolderPositions(cache.folders));
      setSections(normalizePositions(cache.sections));
      setBookmarks(cache.bookmarks);
      setSelection(cache.selection ?? { kind: "folder", id: cache.folders[0].id });
      setHydrated(true);
    }
    void refreshBookmarks({
      fallbackToInitial: !cache,
      markHydrated: !cache,
      isCancelled: () => cancelled
    }).finally(() => {
      if (!cancelled) setBootstrapping(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeBookmarkCache({
      version: 3,
      apiBacked,
      savedAt: Date.now(),
      folders,
      sections,
      bookmarks,
      selection: selection ?? undefined
    });
  }, [apiBacked, bookmarks, folders, hydrated, sections, selection]);

  useEffect(() => {
    if (
      (selection?.kind === "folder" && folders.some((folder) => folder.id === selection.id)) ||
      (selection?.kind === "section" && sections.some((section) => section.id === selection.id))
    ) return;
    const firstSection = orderedSections.find((section) => folders.some((folder) => folderSectionId(folder) === section.id));
    setSelection(firstSection
      ? { kind: "section", id: firstSection.id }
      : folders[0]
        ? { kind: "folder", id: folders[0].id }
        : null);
  }, [folders, orderedSections, sections, selection]);

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
        apiRequest<Folder[]>("/api/folders"),
        apiRequest<Section[]>("/api/sections"),
        apiRequest<BookmarkItem[]>("/api/bookmarks")
      ]);
      if (isCancelled()) return false;
      const flatFolders = flattenFolderResponse(remoteFolders);
      if (!flatFolders.length) throw new Error("폴더 데이터가 없습니다.");
      setFolders(flatFolders);
      setSections(normalizePositions(remoteSections));
      setBookmarks(remoteBookmarks);
      setSelection((current) => {
        if (current?.kind === "folder" && flatFolders.some((folder) => folder.id === current.id)) return current;
        if (current?.kind === "section" && remoteSections.some((section) => section.id === current.id)) return current;
        return { kind: "folder", id: flatFolders[0].id };
      });
      setApiBacked(true);
      if (reapplyOptimistic) pendingOptimistic.current.forEach((apply) => apply());
      return true;
    } catch {
      if (fallbackToInitial && !isCancelled()) {
        setFolders(INITIAL_FOLDERS);
        setSections(INITIAL_SECTIONS);
        setBookmarks(INITIAL_BOOKMARKS);
        setSelection(INITIAL_SECTIONS[0]
          ? { kind: "section", id: INITIAL_SECTIONS[0].id }
          : { kind: "folder", id: INITIAL_FOLDERS[0]?.id ?? "" });
      }
      setApiBacked(false);
      return false;
    } finally {
      if (!isCancelled()) {
        setRefreshing(false);
        if (markHydrated) setHydrated(true);
      }
    }
  }

  function persistOptimisticMutation(
    key: string,
    apply: () => void,
    rollback: () => void,
    request: () => Promise<unknown>,
    fallbackMessage: string,
    reconcileOnFailure = false
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
        const refreshed = reconcileOnFailure
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
  }

  function selectFolder(id: string) {
    setSelection({ kind: "folder", id });
    setMobileFoldersOpen(false);
  }

  function selectSection(id: string) {
    setSelection({ kind: "section", id });
    setMobileFoldersOpen(false);
  }

  function openBookmarkDialog(bookmark?: BookmarkItem, folder?: Folder) {
    if (bootstrapping) return;
    setFormError("");
    if (bookmark) {
      setBookmarkDialog({ mode: "edit", bookmarkId: bookmark.id });
      setBookmarkDraft({
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description ?? "",
        folderId: bookmark.folderId ?? folder?.id ?? orderedFolders[0]?.id ?? "",
        isFavorite: bookmark.isFavorite
      });
      return;
    }
    const target = folder ?? selectedFolder ?? visibleFolders[0] ?? orderedFolders[0];
    if (!target) return;
    setBookmarkDraft(emptyBookmarkDraft(target.id));
    setBookmarkDialog({ mode: "create" });
  }

  function openFolderDialog(folder?: Folder) {
    if (bootstrapping) return;
    setFormError("");
    setFolderDraft({
      name: folder?.name ?? "",
      color: folder?.color ?? COLOR_OPTIONS[folders.length % COLOR_OPTIONS.length],
      sectionId: folderSectionId(folder ?? {}) ?? NO_SECTION
    });
    setFolderDialog(folder ? { mode: "edit", folderId: folder.id } : { mode: "create" });
  }

  function openSectionDialog(section?: Section) {
    if (bootstrapping) return;
    setFormError("");
    setSectionDraft({ name: section?.name ?? "", color: section?.color ?? null });
    setSectionDialog(section ? { mode: "edit", sectionId: section.id } : { mode: "create" });
  }

  async function saveBookmark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = bookmarkDraft.title.trim();
    const url = safeUrl(bookmarkDraft.url);
    if (!title || !url || !folders.some((folder) => folder.id === bookmarkDraft.folderId)) {
      setFormError(!title ? "제목을 입력하세요." : !url ? "http 또는 https URL을 입력하세요." : "폴더를 선택하세요.");
      return;
    }
    const payload = {
      title,
      url,
      description: bookmarkDraft.description.trim() || null,
      folderId: bookmarkDraft.folderId,
      isFavorite: bookmarkDraft.isFavorite
    };
    setSaving(true);
    setFormError("");
    try {
      if (bookmarkDialog?.mode === "edit" && bookmarkDialog.bookmarkId) {
        const updated = apiBacked
          ? await apiRequest<BookmarkItem>(`/api/bookmarks/${bookmarkDialog.bookmarkId}`, { method: "PATCH", body: JSON.stringify(payload) })
          : { ...bookmarks.find((bookmark) => bookmark.id === bookmarkDialog.bookmarkId)!, ...payload };
        setBookmarks((current) => current.map((bookmark) => bookmark.id === updated.id ? updated : bookmark));
      } else {
        const created = apiBacked
          ? await apiRequest<BookmarkItem>("/api/bookmarks", { method: "POST", body: JSON.stringify(payload) })
          : { id: createId("bm"), ...payload, position: bookmarks.filter((bookmark) => bookmark.folderId === payload.folderId).length };
        setBookmarks((current) => [...current, created]);
      }
      setBookmarkDialog(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "북마크 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderDraft.name.trim();
    if (!name) return setFormError("폴더 이름을 입력하세요.");
    const sectionId = folderDraft.sectionId === NO_SECTION ? null : folderDraft.sectionId;
    const payload = { name, color: folderDraft.color, sectionId };
    setSaving(true);
    setFormError("");
    try {
      if (folderDialog?.mode === "edit" && folderDialog.folderId) {
        const existing = folders.find((folder) => folder.id === folderDialog.folderId)!;
        const updated = apiBacked
          ? await apiRequest<Folder>(`/api/folders/${folderDialog.folderId}`, { method: "PATCH", body: JSON.stringify(payload) })
          : {
              ...existing,
              ...payload,
              position: folderSectionId(existing) === sectionId
                ? existing.position
                : folders.filter((folder) => folderSectionId(folder) === sectionId).length
            };
        setFolders((current) => normalizeFolderPositions(current.map((folder) => folder.id === updated.id ? updated : folder)));
      } else {
        const created = apiBacked
          ? await apiRequest<Folder>("/api/folders", { method: "POST", body: JSON.stringify(payload) })
          : {
              id: createId("folder"),
              ...payload,
              position: folders.filter((folder) => folderSectionId(folder) === sectionId).length
            };
        setFolders((current) => normalizeFolderPositions([...current, created]));
        setSelection({ kind: "folder", id: created.id });
      }
      setFolderDialog(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "폴더 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = sectionDraft.name.trim();
    if (!name) return setFormError("섹션 이름을 입력하세요.");
    const duplicate = findSectionByName(sections, name);
    if (duplicate && duplicate.id !== sectionDialog?.sectionId) return setFormError("같은 이름의 섹션이 이미 있습니다.");
    setSaving(true);
    setFormError("");
    try {
      if (sectionDialog?.mode === "edit" && sectionDialog.sectionId) {
        const existing = sections.find((section) => section.id === sectionDialog.sectionId);
        const payload: { name?: string; color?: string | null } = {};
        if (existing?.name !== name) payload.name = name;
        if ((existing?.color ?? null) !== sectionDraft.color) payload.color = sectionDraft.color;
        if (!Object.keys(payload).length) {
          setSectionDialog(null);
          return;
        }
        const updated = apiBacked
          ? await apiRequest<Section>(`/api/sections/${sectionDialog.sectionId}`, { method: "PATCH", body: JSON.stringify(payload) })
          : { ...sections.find((section) => section.id === sectionDialog.sectionId)!, ...payload };
        setSections((current) => current.map((section) => section.id === updated.id ? updated : section));
      } else {
        const payload = { name, color: sectionDraft.color };
        const created = apiBacked
          ? await apiRequest<Section>("/api/sections", { method: "POST", body: JSON.stringify(payload) })
          : { id: createId("section"), ...payload, position: sections.length };
        setSections((current) => [...current, created]);
        setSelection({ kind: "section", id: created.id });
      }
      setSectionDialog(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "섹션 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      if (deleteTarget.type === "bookmark") {
        if (apiBacked) await apiRequest<void>(`/api/bookmarks/${deleteTarget.id}`, { method: "DELETE" });
        setBookmarks((current) => current.filter((bookmark) => bookmark.id !== deleteTarget.id));
      } else if (deleteTarget.type === "section") {
        if (apiBacked) await apiRequest<void>(`/api/sections/${deleteTarget.id}`, { method: "DELETE" });
        setSections((current) => normalizePositions(current.filter((section) => section.id !== deleteTarget.id)));
        setFolders((current) => normalizeFolderPositions(current.map((folder) => folderSectionId(folder) === deleteTarget.id ? { ...folder, sectionId: null } : folder)));
        if (selection?.kind === "section" && selection.id === deleteTarget.id) {
          const fallback = folders.find((folder) => folderSectionId(folder) === deleteTarget.id) ?? folders[0];
          setSelection(fallback ? { kind: "folder", id: fallback.id } : null);
        }
      } else {
        if (folders.length <= 1) throw new Error("마지막 폴더는 삭제할 수 없습니다.");
        const fallback = folders.find((folder) => folder.id !== deleteTarget.id);
        if (!fallback) throw new Error("북마크를 이동할 대상 폴더가 없습니다.");
        if (apiBacked) {
          await apiRequest<void>(`/api/folders/${deleteTarget.id}?destination_folder_id=${encodeURIComponent(fallback.id)}`, { method: "DELETE" });
        }
        setFolders((current) => normalizeFolderPositions(current.filter((folder) => folder.id !== deleteTarget.id)));
        setBookmarks((current) => current.map((bookmark) => bookmark.folderId === deleteTarget.id ? { ...bookmark, folderId: fallback.id } : bookmark));
        if (selection?.kind === "folder" && selection.id === deleteTarget.id) setSelection({ kind: "folder", id: fallback.id });
      }
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  function moveFolderToSection(sectionId: string | null) {
    if (!draggingFolderId) return;
    const source = folders.find((folder) => folder.id === draggingFolderId);
    if (!source || folderSectionId(source) === sectionId) return clearFolderDrag();
    const previousSectionId = folderSectionId(source);
    const previousPosition = source.position;
    const nextPosition = folders.filter((folder) => folderSectionId(folder) === sectionId).length;
    persistOptimisticMutation(
      `move:folder:${source.id}`,
      () => setFolders((current) => normalizeFolderPositions(current.map((folder) => folder.id === source.id ? { ...folder, sectionId, position: nextPosition } : folder))),
      () => setFolders((current) => normalizeFolderPositions(current.map((folder) => folder.id === source.id ? { ...folder, sectionId: previousSectionId, position: previousPosition } : folder))),
      () => apiRequest<Folder>(`/api/folders/${source.id}`, { method: "PATCH", body: JSON.stringify({ sectionId }) }),
      "폴더 이동에 실패했습니다."
    );
    clearFolderDrag();
  }

  function dropFolder(targetId: string) {
    if (!draggingFolderId) return;
    const source = folders.find((folder) => folder.id === draggingFolderId);
    const target = folders.find((folder) => folder.id === targetId);
    if (!source || !target || folderSectionId(source) !== folderSectionId(target)) return clearFolderDrag();
    const scoped = folders.filter((folder) => folderSectionId(folder) === folderSectionId(source)).sort((a, b) => a.position - b.position);
    const moved = moveById(scoped, source.id, target.id);
    const changes = getPositionChanges(scoped, moved);
    if (changes.length) {
      persistOptimisticMutation(
        `reorder:folders:${folderSectionId(source) ?? NO_SECTION}`,
        () => setFolders((current) => applyPositions(current, moved)),
        () => setFolders((current) => updateMatchingPositions(current, changes, "rollback")),
        () => apiRequest<void>("/api/folders/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
        "폴더 순서 저장에 실패했습니다.",
        true
      );
    }
    clearFolderDrag();
  }

  function dropSection(targetId: string) {
    if (!draggingSectionId) return;
    const moved = moveById(orderedSections, draggingSectionId, targetId);
    const changes = getPositionChanges(orderedSections, moved);
    if (changes.length) {
      persistOptimisticMutation(
        "reorder:sections",
        () => setSections((current) => applyPositions(current, moved)),
        () => setSections((current) => updateMatchingPositions(current, changes, "rollback")),
        () => apiRequest<void>("/api/sections/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
        "섹션 순서 저장에 실패했습니다.",
        true
      );
    }
    setDraggingSectionId(null);
    setDragOverSectionId(null);
  }

  function dropBookmark(targetId: string) {
    if (!draggingBookmarkId) return;
    const source = bookmarks.find((bookmark) => bookmark.id === draggingBookmarkId);
    const target = bookmarks.find((bookmark) => bookmark.id === targetId);
    if (!source || !target || source.folderId !== target.folderId) return clearBookmarkDrag();
    const scoped = bookmarks.filter((bookmark) => bookmark.folderId === source.folderId).sort((a, b) => a.position - b.position);
    const moved = moveById(scoped, source.id, target.id);
    const changes = getPositionChanges(scoped, moved);
    if (changes.length) {
      persistOptimisticMutation(
        `reorder:bookmarks:${source.folderId}`,
        () => setBookmarks((current) => applyPositions(current, moved)),
        () => setBookmarks((current) => updateMatchingPositions(current, changes, "rollback")),
        () => apiRequest<void>("/api/bookmarks/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
        "북마크 순서 저장에 실패했습니다.",
        true
      );
    }
    clearBookmarkDrag();
  }

  function toggleFavorite(id: string) {
    const bookmark = bookmarks.find((item) => item.id === id);
    if (!bookmark) return;
    const next = !bookmark.isFavorite;
    persistOptimisticMutation(
      `favorite:${id}`,
      () => setBookmarks((current) => current.map((item) => item.id === id ? { ...item, isFavorite: next } : item)),
      () => setBookmarks((current) => current.map((item) => item.id === id ? { ...item, isFavorite: bookmark.isFavorite } : item)),
      () => apiRequest<BookmarkItem>(`/api/bookmarks/${id}`, { method: "PATCH", body: JSON.stringify({ isFavorite: next }) }),
      "즐겨찾기 변경에 실패했습니다."
    );
  }

  function clearFolderDrag() {
    setDraggingFolderId(null);
    setDragOverFolderId(null);
    setDragOverSectionId(null);
  }

  function clearBookmarkDrag() {
    setDraggingBookmarkId(null);
    setDragOverBookmarkId(null);
  }

  if (!hydrated) return <BookmarksLoading />;

  const sidebarProps = {
    folders: orderedFolders,
    sections: orderedSections,
    bookmarks,
    favoriteOnly,
    selection,
    draggingFolderId,
    draggingSectionId,
    dragOverFolderId,
    dragOverSectionId,
    onSelectFolder: selectFolder,
    onSelectSection: selectSection,
    onAddFolder: () => openFolderDialog(),
    onAddSection: () => openSectionDialog(),
    onEditFolder: openFolderDialog,
    onDeleteFolder: (folder: Folder) => setDeleteTarget({ type: "folder" as const, id: folder.id }),
    onEditSection: openSectionDialog,
    onDeleteSection: (section: Section) => setDeleteTarget({ type: "section" as const, id: section.id }),
    onRefresh: () => void refreshBookmarks(),
    refreshing,
    mutationsDisabled: bootstrapping,
    onDragFolder: (id: string | null) => {
      if (!bootstrapping) setDraggingFolderId(id);
      if (!id) clearFolderDrag();
    },
    onDragSection: (id: string | null) => {
      if (!bootstrapping) setDraggingSectionId(id);
      if (!id) setDragOverSectionId(null);
    },
    onDragOverFolder: setDragOverFolderId,
    onDragOverSection: setDragOverSectionId,
    onDropFolder: dropFolder,
    onDropFolderOnSection: moveFolderToSection,
    onDropSection: dropSection
  };

  return (
    <div className="fade-in flex h-full min-h-0 overflow-hidden bg-white" aria-busy={bootstrapping}>
      <ConsoleSidebar {...sidebarProps} className="hidden lg:flex" />
      {mobileFoldersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="북마크 메뉴">
          <button type="button" aria-label="폴더 메뉴 닫기" className="absolute inset-0 bg-black/30" onClick={() => setMobileFoldersOpen(false)} />
          <ConsoleSidebar {...sidebarProps} id="mobile-console-sidebar" className="absolute inset-y-0 left-0 flex shadow-2xl" />
        </div>
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border-subtle)] bg-white px-3 py-2 lg:hidden">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className={BOOKMARK_TOUCH_TARGET_CLASS} onClick={() => setMobileFoldersOpen(true)} aria-controls="mobile-console-sidebar">
              <Menu className="h-5 w-5" /><span className="sr-only">폴더 메뉴 열기</span>
            </Button>
            <PageTitle name={activeName} color={activeColor} count={currentCount} />
            <FavoriteButton compact count={favoriteCount} active={favoriteOnly} onClick={() => setFavoriteOnly((value) => !value)} />
          </div>
          <SearchBox query={query} setQuery={setQuery} className="mt-2" />
        </header>
        <header className={cn("hidden shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border-subtle)] bg-white px-5 lg:grid", BOOKMARK_APP_HEADER_CLASS)}>
          <PageTitle name={activeName} color={activeColor} count={currentCount} />
          <SearchBox query={query} setQuery={setQuery} />
          <div className="flex items-center gap-2">
            <FavoriteButton count={favoriteCount} active={favoriteOnly} onClick={() => setFavoriteOnly((value) => !value)} />
            <Button size="sm" disabled={bootstrapping || !visibleFolders.length} onClick={() => openBookmarkDialog()} className="h-10 px-3 text-sm">
              <Plus className="h-4 w-4" />북마크 추가
            </Button>
          </div>
        </header>

        <main id="bookmark-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="mx-auto w-full max-w-[1480px] space-y-4 p-[clamp(0.75rem,2vw,2rem)]">
            {mutationError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-bold text-destructive">{mutationError}</div> : null}
            {groups.length === 0 || (filtered.length === 0 && hasActiveFilter) ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white px-6 text-center">
                <div className="mb-3 h-1.5 w-12 rounded-full bg-[var(--color-brand)]" />
                <p className="font-bold text-[var(--text-heading)]">{query ? "검색 결과가 없습니다." : favoriteOnly ? "즐겨찾기한 북마크가 없습니다." : "북마크가 없습니다."}</p>
              </div>
            ) : groups.map((group) => (
              <section key={group.key} className="space-y-3">
                <div className={BOOKMARK_SECTION_HEADER_CLASS}>
                  <span data-folder-color={group.folder.color ?? COLOR_FALLBACK} className="h-6 w-1 rounded-full" style={{ backgroundColor: group.folder.color ?? COLOR_FALLBACK }} aria-hidden="true" />
                  <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-[var(--text-heading)]">{group.label}</h2>
                  <span className="rounded border border-[var(--border-subtle)] bg-[#F8FAFC] px-2 py-1 text-xs tabular-nums text-[var(--text-muted)]">{group.items.length}</span>
                  <FolderActionsMenu
                    folder={group.folder}
                    mutationsDisabled={bootstrapping}
                    onAddBookmark={(folder) => openBookmarkDialog(undefined, folder)}
                    onEdit={openFolderDialog}
                    onDelete={(folder) => setDeleteTarget({ type: "folder", id: folder.id })}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4" aria-label={`${group.label} 북마크, 드래그해서 위치 변경`}>
                  {group.items.map((bookmark) => (
                    <BookmarkCard
                      key={bookmark.id}
                      bookmark={bookmark}
                      dragging={draggingBookmarkId === bookmark.id}
                      dragOver={dragOverBookmarkId === bookmark.id}
                      mutationsDisabled={bootstrapping}
                      onDragStart={setDraggingBookmarkId}
                      onDragEnd={clearBookmarkDrag}
                      onDragOver={(id) => {
                        const source = bookmarks.find((item) => item.id === draggingBookmarkId);
                        const target = bookmarks.find((item) => item.id === id);
                        setDragOverBookmarkId(source?.folderId === target?.folderId ? id : null);
                      }}
                      onDrop={dropBookmark}
                      onEdit={openBookmarkDialog}
                      onDelete={(item) => setDeleteTarget({ type: "bookmark", id: item.id })}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </section>

      {bookmarkDialog ? (
        <Modal title={bookmarkDialog.mode === "edit" ? "북마크 편집" : "북마크 추가"} onClose={() => setBookmarkDialog(null)} closeDisabled={saving}>
          <form className="space-y-4" onSubmit={saveBookmark}>
            <Field label="URL"><Input type="url" value={bookmarkDraft.url} onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, url: event.target.value }))} /></Field>
            <Field label="제목"><Input value={bookmarkDraft.title} onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, title: event.target.value }))} /></Field>
            <Field label="설명"><Textarea value={bookmarkDraft.description} onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, description: event.target.value }))} rows={2} /></Field>
            <Field label="폴더">
              <Select value={bookmarkDraft.folderId} onValueChange={(folderId) => setBookmarkDraft((draft) => ({ ...draft, folderId }))}>
                <SelectTrigger aria-label="폴더"><SelectValue /></SelectTrigger>
                <SelectContent>{orderedFolders.map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={bookmarkDraft.isFavorite} onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, isFavorite: event.target.checked }))} />즐겨찾기</label>
            <FormFooter saving={saving} error={formError} onCancel={() => setBookmarkDialog(null)} />
          </form>
        </Modal>
      ) : null}

      {folderDialog ? (
        <Modal title={folderDialog.mode === "edit" ? "폴더 편집" : "새 폴더"} onClose={() => setFolderDialog(null)} closeDisabled={saving}>
          <form className="space-y-4" onSubmit={saveFolder}>
            <Field label="이름"><Input value={folderDraft.name} onChange={(event) => setFolderDraft((draft) => ({ ...draft, name: event.target.value }))} /></Field>
            <Field label="섹션">
              <Select value={folderDraft.sectionId} onValueChange={(sectionId) => setFolderDraft((draft) => ({ ...draft, sectionId }))}>
                <SelectTrigger aria-label="섹션"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SECTION}>섹션 없음</SelectItem>
                  {orderedSections.map((section) => <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <ColorPicker color={folderDraft.color} onChange={(color) => setFolderDraft((draft) => ({ ...draft, color }))} />
            <FormFooter saving={saving} error={formError} onCancel={() => setFolderDialog(null)} />
          </form>
        </Modal>
      ) : null}

      {sectionDialog ? (
        <Modal title={sectionDialog.mode === "edit" ? "섹션 편집" : "새 섹션"} onClose={() => setSectionDialog(null)} closeDisabled={saving}>
          <form className="space-y-4" onSubmit={saveSection}>
            <Field label="이름"><Input value={sectionDraft.name} onChange={(event) => setSectionDraft((draft) => ({ ...draft, name: event.target.value }))} /></Field>
            <ColorPicker color={sectionDraft.color} allowDefault onChange={(color) => setSectionDraft((draft) => ({ ...draft, color }))} />
            <FormFooter saving={saving} error={formError} onCancel={() => setSectionDialog(null)} />
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title={`${deleteTarget.type === "bookmark" ? "북마크" : deleteTarget.type === "folder" ? "폴더" : "섹션"} 삭제`} onClose={() => setDeleteTarget(null)} closeDisabled={deleting}>
          <p className="text-sm text-[var(--text-secondary)]">
            {deleteTarget.type === "section"
              ? "이 섹션을 삭제합니다. 소속 폴더는 삭제되지 않고 섹션 없음으로 이동합니다."
              : deleteTarget.type === "folder"
                ? "이 폴더를 삭제하고 북마크는 다른 폴더로 이동합니다."
                : "이 북마크를 삭제합니다."}
          </p>
          {deleting ? <div className="mt-4"><DatabaseProgressStatus title="데이터베이스에서 삭제 중" /></div> : null}
          {deleteError ? <p className="mt-4 text-sm font-bold text-destructive">{deleteError}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? <LoaderCircle className="animate-spin" /> : null}
              {deleting ? "삭제 중..." : "삭제"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function PageTitle({ name, color, count }: { name: string; color: string; count: number }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="h-5 w-1 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <h1 className="truncate text-lg font-bold text-[var(--text-heading)]">{name}</h1>
      <span className="rounded border border-[var(--border-subtle)] bg-[#F8FAFC] px-2 py-1 text-xs tabular-nums text-[var(--text-muted)]">{count}</span>
    </div>
  );
}

function SearchBox({ query, setQuery, className }: { query: string; setQuery: (value: string) => void; className?: string }) {
  return (
    <label className={cn("relative min-w-0", className)}>
      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="북마크 검색..." className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[#F8FAFC] pl-11 pr-11 text-sm outline-none focus:border-[var(--color-brand)]" />
      {query ? <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")} className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center"><X className="h-4 w-4" /></button> : null}
    </label>
  );
}

function FavoriteButton({ count, active, onClick, compact = false }: { count: number; active: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <Button variant={active ? "default" : "outline"} size={compact ? "icon" : "sm"} aria-pressed={active} aria-label={`즐겨찾기 ${count}개만 보기`} onClick={onClick} className={compact ? BOOKMARK_TOUCH_TARGET_CLASS : "h-10 px-3 text-sm"}>
      <Star className={cn("h-4 w-4", active && "fill-current")} />{compact ? null : <>즐겨찾기 <span>{count}</span></>}
    </Button>
  );
}

function ColorPicker({ color, onChange, allowDefault = false }: { color: string | null; onChange: (color: string | null) => void; allowDefault?: boolean }) {
  return (
    <Field label="색상">
      <div className="flex flex-wrap gap-2">
        {allowDefault ? <button type="button" onClick={() => onChange(null)} className={cn("h-8 rounded border px-2 text-xs", color === null && "ring-2 ring-[var(--color-brand)]")}>기본</button> : null}
        {COLOR_OPTIONS.map((option) => <button key={option} type="button" aria-label={`색상 ${option}`} onClick={() => onChange(option)} className={cn("h-8 w-8 rounded border", color === option && "ring-2 ring-[var(--color-brand)] ring-offset-2")} style={{ backgroundColor: option }} />)}
      </div>
    </Field>
  );
}

function FormFooter({ saving, error, onCancel }: { saving: boolean; error: string; onCancel: () => void }) {
  return (
    <>
      {saving ? <DatabaseProgressStatus title="데이터베이스에 저장 중" /> : null}
      {error ? <p className="text-sm font-bold text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>취소</Button>
        <Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : null}{saving ? "저장 중..." : "저장"}</Button>
      </div>
    </>
  );
}
