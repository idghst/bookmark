"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, FolderPlus, Menu, Plus, Search, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConsoleSidebar } from "@/app/(dashboard)/ConsoleSidebar";
import { BookmarkCard } from "@/app/(dashboard)/bookmarks-ui/BookmarkCard";
import { BookmarksLoading } from "@/app/(dashboard)/bookmarks-ui/BookmarksLoading";
import { DatabaseProgressStatus } from "@/app/(dashboard)/bookmarks-ui/DatabaseProgressStatus";
import { Field } from "@/app/(dashboard)/bookmarks-ui/Field";
import { FolderActionsMenu, FolderSectionActionsMenu } from "@/app/(dashboard)/bookmarks-ui/SectionActionsMenu";
import { Modal } from "@/app/(dashboard)/bookmarks-ui/Modal";
import { DropPreview, MovePreview, type MovePreviewInfo } from "@/app/(dashboard)/bookmarks-ui/MovePreview";
import { readBookmarkCache, writeBookmarkCache } from "@/app/lib/bookmarks/cache";
import { apiRequest } from "@/app/lib/bookmarks/client-api";
import {
  BOOKMARK_APP_HEADER_CLASS,
  BOOKMARK_SECTION_HEADER_CLASS,
  BOOKMARK_TOUCH_TARGET_CLASS,
  COLOR_FALLBACK,
  COLOR_OPTIONS,
  NO_SECTION
} from "@/app/lib/bookmarks/constants";
import { countBookmarks, matchesBookmarkFilters } from "@/app/lib/bookmarks/counts";
import { flattenFolderResponse, folderSectionId, normalizeFolderPositions } from "@/app/lib/bookmarks/folder-tree";
import { bookmarkFolderSectionId, buildBookmarkGroups } from "@/app/lib/bookmarks/groups";
import {
  applyPositions,
  createId,
  getPositionChanges,
  insertEdgeFromPointer,
  insertIndexFromPointer,
  moveToIndex,
  normalizePositions,
  scrollFromPointer,
  updateMatchingPositions
} from "@/app/lib/bookmarks/positions";
import { INITIAL_BOOKMARKS, INITIAL_FOLDERS, INITIAL_SECTIONS } from "@/app/lib/bookmarks/sample-data";
import { findSectionByName } from "@/app/lib/bookmarks/sections";
import type { BookmarkItem, BookmarkSnapshot, Folder, FolderSection, Section } from "@/app/lib/bookmarks/types";
import { safeUrl } from "@/app/lib/bookmarks/url";
import { cn } from "@/lib/utils";

type Selection = { kind: "folder" | "section"; id: string };
type BookmarkDialog = { mode: "create" | "edit"; bookmarkId?: string };
type FolderDialog = { mode: "create" | "edit"; folderId?: string };
type SectionDialog = { mode: "create" | "edit"; sectionId?: string };
type DeleteTarget = { type: "bookmark" | "folder" | "section" | "folderSection"; id: string };

type BookmarkDraft = {
  title: string;
  url: string;
  description: string;
  folderId: string;
  folderSectionId: string;
  isFavorite: boolean;
};

const emptyBookmarkDraft = (folderId: string, folderSectionId = NO_SECTION): BookmarkDraft => ({
  title: "",
  url: "",
  description: "",
  folderId,
  folderSectionId,
  isFavorite: false
});

// Only replace fields that still have this operation's optimistic value.
function mergeUnchanged<T extends { id: string }>(current: T, expected: T, next: T): T {
  const merged = { ...current };
  for (const field of Object.keys(next) as Array<keyof T>) {
    if (current[field] === expected[field]) merged[field] = next[field];
  }
  return merged;
}

function upsertOptimistic<T extends { id: string }>(current: T[], item: T, editing: boolean): T[] {
  return editing ? current.map((entry) => entry.id === item.id ? { ...entry, ...item } : entry)
    : current.some((entry) => entry.id === item.id) ? current : [...current, item];
}

function rollbackItem<T extends { id: string }>(current: T[], previous: T | undefined, optimistic: T): T[] {
  return previous ? current.map((item) => item.id === optimistic.id ? mergeUnchanged(item, optimistic, previous) : item)
    : current.filter((item) => item.id !== optimistic.id);
}

function applyCollectionChange<T extends { id: string }>(current: T[], before: T[], after: T[]): T[] {
  return current.flatMap((item) => {
    const previous = before.find((entry) => entry.id === item.id);
    if (!previous) return [item];
    const next = after.find((entry) => entry.id === item.id);
    if (!next) return [];
    const changed = { ...item };
    for (const field of Object.keys(next) as Array<keyof T>) {
      if (previous[field] !== next[field]) changed[field] = next[field];
    }
    return [changed];
  });
}

function rollbackCollectionChange<T extends { id: string }>(current: T[], before: T[], after: T[]): T[] {
  const restored = current.map((item) => {
    const previous = before.find((entry) => entry.id === item.id);
    const optimistic = after.find((entry) => entry.id === item.id);
    if (!previous || !optimistic) return item;
    const next = { ...item };
    for (const field of Object.keys(previous) as Array<keyof T>) {
      if (previous[field] !== optimistic[field] && item[field] === optimistic[field]) next[field] = previous[field];
    }
    return next;
  });
  return [...restored, ...before.filter((item) => !after.some((entry) => entry.id === item.id) && !current.some((entry) => entry.id === item.id))];
}

export default function BookmarksPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [folderSections, setFolderSections] = useState<FolderSection[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [query, setQuery] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [apiBacked, setApiBacked] = useState(false);
  const [cacheWritable, setCacheWritable] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [pendingDeletes, setPendingDeletes] = useState(0);
  const [mobileFoldersOpen, setMobileFoldersOpen] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [bookmarkDialog, setBookmarkDialog] = useState<BookmarkDialog | null>(null);
  const [folderDialog, setFolderDialog] = useState<FolderDialog | null>(null);
  const [sectionDialog, setSectionDialog] = useState<SectionDialog | null>(null);
  const [folderSectionDialog, setFolderSectionDialog] = useState<{ mode: "create" | "edit"; folderSectionId?: string; folderId?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [bookmarkDraft, setBookmarkDraft] = useState(() => emptyBookmarkDraft(INITIAL_FOLDERS[0]?.id ?? ""));
  const [folderDraft, setFolderDraft] = useState<{ name: string; color: string | null; sectionId: string }>({
    name: "",
    color: COLOR_OPTIONS[0],
    sectionId: NO_SECTION
  });
  const [sectionDraft, setSectionDraft] = useState({ name: "", color: null as string | null });
  const [folderSectionDraft, setFolderSectionDraft] = useState({ name: "", color: null as string | null });
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [draggingFolderSectionId, setDraggingFolderSectionId] = useState<string | null>(null);
  const [draggingBookmarkId, setDraggingBookmarkId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [sectionInsertEdge, setSectionInsertEdge] = useState<"before" | "after" | null>(null);
  const [folderInsert, setFolderInsert] = useState<{ id: string; edge: "before" | "after" } | null>(null);
  const [folderSectionInsert, setFolderSectionInsert] = useState<{ id: string; edge: "before" | "after" } | null>(null);
  const [bookmarkInsert, setBookmarkInsert] = useState<{ id: string; edge: "before" | "after" } | null>(null);
  const [bookmarkGroupTarget, setBookmarkGroupTarget] = useState<string | null>(null);
  const [dragStatus, setDragStatus] = useState("");
  const mutationQueues = useRef(new Map<string, Promise<void>>());
  const failedRollbacks = useRef(new Map<string, Array<() => void>>());
  const pendingOptimistic = useRef(new Map<symbol, () => void>());
  const pendingCreates = useRef(new Set<string>());
  const mutationEpoch = useRef(0);
  const latestMutationEpoch = useRef(new Map<string, number>());
  const persistRemoteRef = useRef(false);
  const mobileFoldersRef = useRef<HTMLDivElement>(null);
  persistRemoteRef.current = apiBacked || refreshing;
  const hasHydratedData = hydrated;
  const mutationsDisabled = !hasHydratedData;
  const isDragging = Boolean(draggingFolderId || draggingSectionId || draggingFolderSectionId || draggingBookmarkId);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-dragging", isDragging);
    if (!isDragging) setDragStatus("");
    return () => document.documentElement.removeAttribute("data-dragging");
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) return;
    function cancelDrag(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      clearFolderDrag();
      clearFolderSectionDrag();
      clearBookmarkDrag();
      setDraggingSectionId(null);
    }
    window.addEventListener("keydown", cancelDrag);
    return () => window.removeEventListener("keydown", cancelDrag);
  }, [isDragging]);

  useEffect(() => {
    if (!mobileFoldersOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const menu = mobileFoldersRef.current;
    const focusableSelector = 'a[href], button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]';
    menu?.querySelector<HTMLElement>(focusableSelector)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || document.querySelector("[data-bookmark-modal]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileFoldersOpen(false);
      } else if (event.key === "Tab") {
        const focusable = [...(menu?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    function handleResize() {
      if (window.innerWidth >= 1024) setMobileFoldersOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      previousFocus?.focus();
    };
  }, [mobileFoldersOpen]);

  function announceDrop(message: string) {
    setDragStatus((current) => (current === message ? current : message));
  }

  function noteMutation() {
    mutationEpoch.current += 1;
  }

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
  const showFolderEmptyState = visibleFolders.length === 0 && !hasActiveFilter;
  const folderEmptyMessage = folders.length === 0
    ? "폴더를 먼저 만들어 보세요."
    : selectedSection ? "이 섹션에 폴더가 없습니다." : "표시할 폴더가 없습니다.";
  const folderCreateLabel = folders.length === 0
    ? "첫 폴더 만들기"
    : selectedSection ? "이 섹션에 폴더 만들기" : "폴더 만들기";
  const groups = useMemo(
    () => {
      const current = buildBookmarkGroups(filtered, visibleFolders, folderSections, hasActiveFilter, Boolean(selectedFolder));
      if (!draggingBookmarkId) return current;
      const targets = buildBookmarkGroups(filtered, visibleFolders, folderSections, hasActiveFilter, Boolean(selectedFolder), true);
      return [...current, ...targets.filter((target) => !current.some((group) => group.key === target.key))];
    },
    [filtered, folderSections, hasActiveFilter, selectedFolder, visibleFolders, draggingBookmarkId]
  );
  const folderSectionsForDraft = useMemo(
    () => folderSections.filter((section) => section.folderId === bookmarkDraft.folderId).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "ko")),
    [bookmarkDraft.folderId, folderSections]
  );
  const visibleBookmarks = bookmarks.filter((bookmark) => visibleFolderIds.has(bookmark.folderId ?? ""));
  const currentCount = hasActiveFilter ? filtered.length : visibleBookmarks.length;
  const favoriteCount = countBookmarks(visibleBookmarks, { favoriteOnly: true });
  const activeName = selectedFolder?.name ?? selectedSection?.name ?? "북마크";
  const activeColor = selectedFolder?.color ?? selectedSection?.color ?? COLOR_FALLBACK;

  function sectionPath(id: string | null) {
    return sections.find((section) => section.id === id)?.name ?? "섹션 없음";
  }

  function bookmarkPath(folderId: string | null, innerSectionId: string | null) {
    const folder = folders.find((item) => item.id === folderId);
    return `${sectionPath(folder ? folderSectionId(folder) : null)} / ${folder?.name ?? "폴더 없음"} / ${folderSections.find((item) => item.id === innerSectionId)?.name ?? "섹션 없음"}`;
  }

  const draggingBookmark = bookmarks.find((item) => item.id === draggingBookmarkId);
  const draggingFolderSection = folderSections.find((item) => item.id === draggingFolderSectionId);
  const movePreview: MovePreviewInfo | null = (() => {
    if (draggingBookmark) {
      const target = bookmarks.find((item) => item.id === bookmarkInsert?.id);
      const group = groups.find((item) => item.key === bookmarkGroupTarget);
      const folder = folders.find((item) => item.id === dragOverFolderId);
      const destinationFolderId = target?.folderId ?? group?.folder.id ?? folder?.id;
      if (!destinationFolderId) return null;
      const destinationSectionId = target ? bookmarkFolderSectionId(target) : group?.folderSection?.id ?? null;
      return {
        title: draggingBookmark.title,
        from: bookmarkPath(draggingBookmark.folderId, bookmarkFolderSectionId(draggingBookmark)),
        to: bookmarkPath(destinationFolderId, destinationSectionId),
        placement: target ? `${target.title} ${bookmarkInsert?.edge === "before" ? "앞" : "뒤"}` : "마지막 위치에 놓기"
      };
    }
    const sourceFolder = folders.find((item) => item.id === draggingFolderId);
    if (sourceFolder) {
      const target = folders.find((item) => item.id === folderInsert?.id);
      if (!target && !dragOverSectionId) return null;
      return {
        title: sourceFolder.name,
        from: sectionPath(folderSectionId(sourceFolder)),
        to: sectionPath(target ? folderSectionId(target) : dragOverSectionId === NO_SECTION ? null : dragOverSectionId),
        placement: target ? `${target.name} ${folderInsert?.edge === "before" ? "앞" : "뒤"}` : "마지막 위치에 놓기",
        contents: `북마크 ${bookmarks.filter((item) => item.folderId === sourceFolder.id).length}개 함께 이동`
      };
    }
    const sourceSection = sections.find((item) => item.id === draggingSectionId);
    const targetSection = sections.find((item) => item.id === dragOverSectionId);
    if (sourceSection && targetSection && sectionInsertEdge) {
      const carriedFolders = orderedFolders.filter((item) => folderSectionId(item) === sourceSection.id);
      return { title: sourceSection.name, from: "사이드바", to: "사이드바", placement: `${targetSection.name} ${sectionInsertEdge === "before" ? "앞" : "뒤"}`, contents: `폴더 ${carriedFolders.length}개${carriedFolders.length ? ` · ${carriedFolders.map((item) => item.name).join(", ")}` : ""}` };
    }
    const targetFolderSection = folderSections.find((item) => item.id === folderSectionInsert?.id);
    if (draggingFolderSection && targetFolderSection && folderSectionInsert) {
      const path = bookmarkPath(draggingFolderSection.folderId, draggingFolderSection.id);
      return { title: draggingFolderSection.name, from: path, to: bookmarkPath(targetFolderSection.folderId, targetFolderSection.id), placement: `${targetFolderSection.name} ${folderSectionInsert.edge === "before" ? "앞" : "뒤"}`, contents: `북마크 ${bookmarks.filter((item) => bookmarkFolderSectionId(item) === draggingFolderSectionId).length}개 함께 이동` };
    }
    return null;
  })();
  const editedBookmark = bookmarks.find((item) => item.id === bookmarkDialog?.bookmarkId);
  const bookmarkDraftPreview: MovePreviewInfo | null = editedBookmark && (
    editedBookmark.folderId !== bookmarkDraft.folderId
    || bookmarkFolderSectionId(editedBookmark) !== (bookmarkDraft.folderSectionId === NO_SECTION ? null : bookmarkDraft.folderSectionId)
  ) ? {
    title: bookmarkDraft.title || editedBookmark.title,
    from: bookmarkPath(editedBookmark.folderId, bookmarkFolderSectionId(editedBookmark)),
    to: bookmarkPath(bookmarkDraft.folderId, bookmarkDraft.folderSectionId === NO_SECTION ? null : bookmarkDraft.folderSectionId),
    placement: "저장하면 마지막 위치로 이동"
  } : null;
  const editedFolder = folders.find((item) => item.id === folderDialog?.folderId);
  const folderDraftPreview: MovePreviewInfo | null = editedFolder && folderSectionId(editedFolder) !== (folderDraft.sectionId === NO_SECTION ? null : folderDraft.sectionId) ? {
    title: folderDraft.name || editedFolder.name,
    from: sectionPath(folderSectionId(editedFolder)),
    to: sectionPath(folderDraft.sectionId === NO_SECTION ? null : folderDraft.sectionId),
    placement: "저장하면 마지막 위치로 이동",
    contents: `북마크 ${bookmarks.filter((item) => item.folderId === editedFolder.id).length}개 함께 이동`
  } : null;

  useEffect(() => {
    let cancelled = false;
    const cache = readBookmarkCache();
    if (cache) {
      setFolders(normalizeFolderPositions(cache.folders));
      setSections(normalizePositions(cache.sections));
      setFolderSections(cache.folderSections);
      setBookmarks(cache.bookmarks);
      setSelection(cache.selection ?? (cache.folders[0] ? { kind: "folder", id: cache.folders[0].id } : null));
      setHydrated(true);
    }
    void refreshBookmarks({
      fallbackToInitial: !cache,
      markHydrated: !cache,
      isCancelled: () => cancelled
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || pendingWrites > 0) return;
    setCacheWritable(writeBookmarkCache({
      apiBacked,
      savedAt: Date.now(),
      folders,
      sections,
      folderSections,
      bookmarks,
      selection: selection ?? undefined
    }));
  }, [apiBacked, bookmarks, folderSections, folders, hydrated, pendingWrites, sections, selection]);

  useEffect(() => {
    if (!hydrated) return;
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
  }, [folders, hydrated, orderedSections, sections, selection]);

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
    const epochAtStart = mutationEpoch.current;
    setRefreshing(true);
    try {
      const { folders: remoteFolders, sections: remoteSections, folderSections: remoteFolderSections, bookmarks: remoteBookmarks } = await apiRequest<BookmarkSnapshot>("/api/snapshot");
      if (isCancelled()) return false;
      const flatFolders = flattenFolderResponse(remoteFolders);
      const stale = mutationEpoch.current !== epochAtStart || (!reapplyOptimistic && pendingOptimistic.current.size > 0);
      if (!stale) {
        setFolders(flatFolders);
        setSections(normalizePositions(remoteSections));
        setFolderSections(normalizePositions(remoteFolderSections));
        setBookmarks(remoteBookmarks);
        setSelection((current) => {
          if (current?.kind === "folder" && flatFolders.some((folder) => folder.id === current.id)) return current;
          if (current?.kind === "section" && remoteSections.some((section) => section.id === current.id)) return current;
          return flatFolders[0]
            ? { kind: "folder", id: flatFolders[0].id }
            : remoteSections[0]
              ? { kind: "section", id: remoteSections[0].id }
              : null;
        });
      }
      pendingOptimistic.current.forEach((apply) => apply());
      setApiBacked(true);
      return !reapplyOptimistic || !stale;
    } catch {
      if (isCancelled()) return false;
      if (fallbackToInitial) {
        setFolders(INITIAL_FOLDERS);
        setSections(INITIAL_SECTIONS);
        setFolderSections([]);
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
    reconcileOnFailure = false,
    onSuccess?: (result: unknown) => void
  ) {
    if (!hasHydratedData) return;
    const queueKey = /^(form:|favorite:|move:(bookmark|folder):|delete:(bookmark|folder|section|folderSection):)/.test(key)
      ? `item:${key.split(":").at(-1)}` : key;
    setMutationError("");
    noteMutation();
    const epoch = mutationEpoch.current;
    // A local-only edit needs an epoch only while an older request for this key is still in flight.
    if (persistRemoteRef.current || mutationQueues.current.has(queueKey)) {
      latestMutationEpoch.current.set(key, epoch);
    }
    apply();
    if (!persistRemoteRef.current) return;
    setPendingWrites((count) => count + 1);
    const token = Symbol(key);
    pendingOptimistic.current.set(token, () => {
      if (latestMutationEpoch.current.get(key) !== epoch) return;
      apply();
    });
    const previous = mutationQueues.current.get(queueKey) ?? Promise.resolve();
    const queued = previous.catch(() => undefined).then(async () => {
      try {
        const result = await request();
        if (latestMutationEpoch.current.get(key) === epoch) onSuccess?.(result);
        failedRollbacks.current.delete(key);
        pendingOptimistic.current.delete(token);
        noteMutation();
      } catch (error) {
        pendingOptimistic.current.delete(token);
        const isLatest = latestMutationEpoch.current.get(key) === epoch;
        if (isLatest) {
          const refreshed = reconcileOnFailure
            ? await refreshBookmarks({ reapplyOptimistic: true })
            : false;
          if (!refreshed) {
            rollback();
            [...(failedRollbacks.current.get(key) ?? [])].reverse().forEach((undo) => undo());
            pendingOptimistic.current.forEach((apply) => apply());
          }
          failedRollbacks.current.delete(key);
        } else {
          failedRollbacks.current.set(key, [...(failedRollbacks.current.get(key) ?? []), rollback]);
        }
        noteMutation();
        if (isLatest) {
          setMutationError(error instanceof Error ? error.message : fallbackMessage);
        }
      } finally {
        setPendingWrites((count) => count - 1);
      }
    });
    mutationQueues.current.set(queueKey, queued);
    void queued.finally(() => {
      if (mutationQueues.current.get(queueKey) === queued) mutationQueues.current.delete(queueKey);
      if (latestMutationEpoch.current.get(key) === epoch) latestMutationEpoch.current.delete(key);
    });
  }

  function hasPendingCreation(...ids: Array<string | null | undefined>) {
    if (!ids.some((id) => id && pendingCreates.current.has(id))) return false;
    setMutationError("이 항목을 저장 중입니다. 저장이 끝나면 다시 시도하세요.");
    return true;
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
    if (hasPendingCreation(bookmark?.id, folder?.id)) return;
    setFormError("");
    if (bookmark) {
      setBookmarkDialog({ mode: "edit", bookmarkId: bookmark.id });
      setBookmarkDraft({
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description ?? "",
        folderId: bookmark.folderId ?? folder?.id ?? orderedFolders[0]?.id ?? "",
        folderSectionId: bookmarkFolderSectionId(bookmark) ?? NO_SECTION,
        isFavorite: bookmark.isFavorite
      });
      return;
    }
    const target = folder ?? selectedFolder ?? visibleFolders[0] ?? orderedFolders[0];
    if (!target) return;
    setBookmarkDraft(emptyBookmarkDraft(target.id));
    setBookmarkDialog({ mode: "create" });
  }

  function openBookmarkDialogInSection(folder: Folder, folderSection: FolderSection | null) {
    if (hasPendingCreation(folder.id, folderSection?.id)) return;
    setFormError("");
    setBookmarkDraft(emptyBookmarkDraft(folder.id, folderSection?.id ?? NO_SECTION));
    setBookmarkDialog({ mode: "create" });
  }

  function openFolderSectionDialog(folderSection?: FolderSection, folderId?: string) {
    const targetFolderId = folderSection?.folderId ?? folderId ?? selectedFolder?.id;
    if (!targetFolderId) return;
    if (hasPendingCreation(targetFolderId, folderSection?.id)) return;
    setFormError("");
    setFolderSectionDraft({ name: folderSection?.name ?? "", color: folderSection?.color ?? null });
    setFolderSectionDialog(folderSection
      ? { mode: "edit", folderSectionId: folderSection.id, folderId: folderSection.folderId }
      : { mode: "create", folderId: targetFolderId });
  }

  function openFolderDialog(folder?: Folder) {
    if (hasPendingCreation(folder?.id)) return;
    setFormError("");
    setFolderDraft({
      name: folder?.name ?? "",
      color: folder?.color ?? COLOR_OPTIONS[folders.length % COLOR_OPTIONS.length],
      sectionId: folder ? folderSectionId(folder) ?? NO_SECTION : selectedSection?.id ?? NO_SECTION
    });
    setFolderDialog(folder ? { mode: "edit", folderId: folder.id } : { mode: "create" });
  }

  function openSectionDialog(section?: Section) {
    if (hasPendingCreation(section?.id)) return;
    setFormError("");
    setSectionDraft({ name: section?.name ?? "", color: section?.color ?? null });
    setSectionDialog(section ? { mode: "edit", sectionId: section.id } : { mode: "create" });
  }

  function saveBookmark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = bookmarkDraft.title.trim();
    const url = safeUrl(bookmarkDraft.url);
    if (!title || !url || !folders.some((folder) => folder.id === bookmarkDraft.folderId)) {
      setFormError(!title ? "제목을 입력하세요." : !url ? "http 또는 https URL을 입력하세요." : "폴더를 선택하세요.");
      return;
    }
    const editingId = bookmarkDialog?.mode === "edit" ? bookmarkDialog.bookmarkId : undefined;
    if (hasPendingCreation(editingId, bookmarkDraft.folderId, bookmarkDraft.folderSectionId)) return;
    const previous = bookmarks.find((item) => item.id === editingId);
    const payload = {
      title, url, description: bookmarkDraft.description.trim() || null,
      folderId: bookmarkDraft.folderId,
      folderSectionId: bookmarkDraft.folderSectionId === NO_SECTION ? null : bookmarkDraft.folderSectionId,
      isFavorite: bookmarkDraft.isFavorite
    };
    const id = editingId ?? createId("bm");
    const moved = previous && (previous.folderId !== payload.folderId || bookmarkFolderSectionId(previous) !== payload.folderSectionId);
    const optimistic: BookmarkItem = {
      id, ...payload,
      position: previous && !moved ? previous.position : bookmarks.reduce((next, item) => (
        item.id !== id && item.folderId === payload.folderId && bookmarkFolderSectionId(item) === payload.folderSectionId
          ? Math.max(next, item.position + 1) : next
      ), 0)
    };
    const changedPayload = previous ? Object.fromEntries(Object.entries(payload).filter(([field, value]) => (
      value !== (field === "url" ? safeUrl(previous.url) : field === "folderSectionId" ? bookmarkFolderSectionId(previous) : previous[field as keyof BookmarkItem])
    ))) : payload;
    setFormError("");
    setBookmarkDialog(null);
    if (!Object.keys(changedPayload).length) return;
    persistFormMutation(id, Boolean(editingId),
      () => setBookmarks((current) => previous ? applyCollectionChange(current, [previous], [optimistic]) : upsertOptimistic(current, optimistic, false)),
      () => setBookmarks((current) => rollbackItem(current, previous, optimistic)),
      () => apiRequest<BookmarkItem>(editingId ? `/api/bookmarks/${id}` : "/api/bookmarks", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(changedPayload)
      }),
      (saved) => setBookmarks((current) => current.map((item) => item.id === id ? mergeUnchanged(item, optimistic, saved) : item)),
      "북마크 저장에 실패했습니다.");
  }

  function saveFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderDraft.name.trim();
    if (!name) return setFormError("폴더 이름을 입력하세요.");
    const sectionId = folderDraft.sectionId === NO_SECTION ? null : folderDraft.sectionId;
    const editingId = folderDialog?.mode === "edit" ? folderDialog.folderId : undefined;
    if (hasPendingCreation(editingId, sectionId)) return;
    const previous = folders.find((item) => item.id === editingId);
    const id = editingId ?? createId("folder");
    const payload = { name, color: folderDraft.color, sectionId };
    const optimistic: Folder = { id, ...payload, position: previous && folderSectionId(previous) === sectionId
      ? previous.position : folders.filter((folder) => folder.id !== id && folderSectionId(folder) === sectionId).length };
    setFormError("");
    setFolderDialog(null);
    persistFormMutation(id, Boolean(editingId),
      () => {
        setFolders((current) => normalizeFolderPositions(previous ? applyCollectionChange(current, [previous], [optimistic]) : upsertOptimistic(current, optimistic, false)));
        if (!editingId) setSelection((current) => current?.id === id || current === selection ? { kind: "folder", id } : current);
      },
      () => setFolders((current) => normalizeFolderPositions(rollbackItem(current, previous, optimistic))),
      () => apiRequest<Folder>(editingId ? `/api/folders/${id}` : "/api/folders", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) }),
      (saved) => {
        setFolders((current) => normalizeFolderPositions(current.map((item) => item.id === id ? mergeUnchanged(item, optimistic, saved) : item)));
        if (!editingId) setSelection((current) => current?.kind === "folder" && current.id === id ? { kind: "folder", id: saved.id } : current);
      }, "폴더 저장에 실패했습니다.");
  }

  function saveSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = sectionDraft.name.trim();
    if (!name) return setFormError("섹션 이름을 입력하세요.");
    const duplicate = findSectionByName(sections, name);
    if (duplicate && duplicate.id !== sectionDialog?.sectionId) return setFormError("같은 이름의 섹션이 이미 있습니다.");
    const editingId = sectionDialog?.mode === "edit" ? sectionDialog.sectionId : undefined;
    if (hasPendingCreation(editingId)) return;
    const previous = sections.find((item) => item.id === editingId);
    const id = editingId ?? createId("section");
    const payload: { name?: string; color?: string | null } = {};
    if (!previous || previous.name !== name) payload.name = name;
    if (!previous || (previous.color ?? null) !== sectionDraft.color) payload.color = sectionDraft.color;
    setFormError("");
    setSectionDialog(null);
    if (!Object.keys(payload).length) return;
    const optimistic: Section = { id, name, color: sectionDraft.color, position: previous?.position ?? sections.length };
    persistFormMutation(id, Boolean(editingId),
      () => {
        setSections((current) => previous ? applyCollectionChange(current, [previous], [optimistic]) : upsertOptimistic(current, optimistic, false));
        if (!editingId) setSelection((current) => current?.id === id || current === selection ? { kind: "section", id } : current);
      },
      () => setSections((current) => rollbackItem(current, previous, optimistic)),
      () => apiRequest<Section>(editingId ? `/api/sections/${id}` : "/api/sections", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) }),
      (saved) => {
        setSections((current) => current.map((item) => item.id === id ? mergeUnchanged(item, optimistic, saved) : item));
        if (!editingId) setSelection((current) => current?.kind === "section" && current.id === id ? { kind: "section", id: saved.id } : current);
      }, "섹션 저장에 실패했습니다.");
  }

  function saveFolderSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderSectionDraft.name.trim();
    const folderId = folderSectionDialog?.folderId;
    if (!name) return setFormError("섹션 이름을 입력하세요.");
    if (!folderId) return setFormError("폴더를 선택하세요.");
    const editingId = folderSectionDialog.mode === "edit" ? folderSectionDialog.folderSectionId : undefined;
    if (hasPendingCreation(editingId, folderId)) return;
    if (folderSections.some((section) => section.folderId === folderId && section.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase() && section.id !== editingId)) {
      return setFormError("같은 이름의 섹션이 이미 있습니다.");
    }
    const previous = folderSections.find((item) => item.id === editingId);
    const id = editingId ?? createId("folder-section");
    const payload: { name?: string; color?: string | null; folderId?: string } = {};
    if (!previous || previous.name !== name) payload.name = name;
    if (!previous || (previous.color ?? null) !== folderSectionDraft.color) payload.color = folderSectionDraft.color;
    if (!editingId) payload.folderId = folderId;
    setFormError("");
    setFolderSectionDialog(null);
    if (!Object.keys(payload).length) return;
    const optimistic: FolderSection = { id, name, color: folderSectionDraft.color, folderId,
      position: previous?.position ?? folderSections.filter((item) => item.folderId === folderId).length };
    persistFormMutation(id, Boolean(editingId),
      () => setFolderSections((current) => previous ? applyCollectionChange(current, [previous], [optimistic]) : upsertOptimistic(current, optimistic, false)),
      () => setFolderSections((current) => rollbackItem(current, previous, optimistic)),
      () => apiRequest<FolderSection>(editingId ? `/api/folder-sections/${id}` : "/api/folder-sections", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) }),
      (saved) => setFolderSections((current) => current.map((item) => item.id === id ? mergeUnchanged(item, optimistic, saved) : item)),
      "섹션 저장에 실패했습니다.");
  }

  function persistFormMutation<T extends { id: string }>(
    id: string, editing: boolean, apply: () => void, rollback: () => void,
    request: () => Promise<T>, saved: (item: T) => void, message: string
  ) {
    if (!editing && persistRemoteRef.current) pendingCreates.current.add(id);
    persistOptimisticMutation(`form:${id}`, apply, rollback, async () => {
      try {
        const result = await request();
        // Creation must replace the temporary identity even when unrelated work happened meanwhile.
        if (!editing && result) saved(result);
        return result;
      } finally {
        pendingCreates.current.delete(id);
      }
    }, message, false, (result) => { if (editing && result) saved(result as T); });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    if (hasPendingCreation(target.id)) return;
    const fallback = folders.find((folder) => folder.id !== target.id && !pendingCreates.current.has(folder.id));
    if (target.type === "folder" && (folders.length <= 1 || !fallback)) {
      setDeleteError(folders.length <= 1 ? "마지막 폴더는 삭제할 수 없습니다." : "북마크를 이동할 대상 폴더가 없습니다.");
      return;
    }
    // Related temporary children must finish creation before their parent can be deleted.
    const related = target.type === "folder"
      ? [...bookmarks.filter((item) => item.folderId === target.id), ...folderSections.filter((item) => item.folderId === target.id)]
      : target.type === "section" ? folders.filter((item) => folderSectionId(item) === target.id)
      : target.type === "folderSection" ? bookmarks.filter((item) => bookmarkFolderSectionId(item) === target.id) : [];
    if (hasPendingCreation(...related.map((item) => item.id))) return;
    const movedPositions = new Map<string, number>();
    if (target.type === "folder") {
      const start = bookmarks.reduce((next, item) => item.folderId === fallback!.id && bookmarkFolderSectionId(item) === null
        ? Math.max(next, item.position + 1) : next, 0);
      bookmarks.filter((item) => item.folderId === target.id)
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        .forEach((item, index) => movedPositions.set(item.id, start + index));
    }
    const nextBookmarks = target.type === "bookmark" ? bookmarks.filter((item) => item.id !== target.id)
      : target.type === "folder" ? bookmarks.map((item) => item.folderId === target.id ? { ...item, folderId: fallback!.id, folderSectionId: null, position: movedPositions.get(item.id)! } : item)
      : target.type === "folderSection" ? bookmarks.map((item) => bookmarkFolderSectionId(item) === target.id ? { ...item, folderSectionId: null } : item) : bookmarks;
    const nextFolders = target.type === "folder" ? normalizeFolderPositions(folders.filter((item) => item.id !== target.id))
      : target.type === "section" ? normalizeFolderPositions(folders.map((item) => folderSectionId(item) === target.id ? { ...item, sectionId: null } : item)) : folders;
    const nextSections = target.type === "section" ? normalizePositions(sections.filter((item) => item.id !== target.id)) : sections;
    const nextFolderSections = target.type === "folderSection" ? folderSections.filter((item) => item.id !== target.id)
      : target.type === "folder" ? folderSections.filter((item) => item.folderId !== target.id) : folderSections;
    const remote = persistRemoteRef.current;
    setDeleteError("");
    setDeleteTarget(null);
    if (remote) setPendingDeletes((count) => count + 1);
    persistOptimisticMutation(`delete:${target.type}:${target.id}`,
      () => {
        setBookmarks((current) => applyCollectionChange(current, bookmarks, nextBookmarks));
        setFolders((current) => applyCollectionChange(current, folders, nextFolders));
        setSections((current) => applyCollectionChange(current, sections, nextSections));
        setFolderSections((current) => applyCollectionChange(current, folderSections, nextFolderSections));
      },
      () => {
        setBookmarks((current) => rollbackCollectionChange(current, bookmarks, nextBookmarks));
        setFolders((current) => rollbackCollectionChange(current, folders, nextFolders));
        setSections((current) => rollbackCollectionChange(current, sections, nextSections));
        setFolderSections((current) => rollbackCollectionChange(current, folderSections, nextFolderSections));
      },
      async () => {
        try {
          const resource = target.type === "bookmark" ? "bookmarks" : target.type === "folder" ? "folders" : target.type === "folderSection" ? "folder-sections" : "sections";
          const destination = target.type === "folder" ? `?destination_folder_id=${encodeURIComponent(fallback!.id)}` : "";
          await apiRequest<void>(`/api/${resource}/${target.id}${destination}`, { method: "DELETE" });
        } finally {
          setPendingDeletes((count) => count - 1);
        }
      }, "삭제에 실패했습니다.", true);
  }

  function moveFolderToSection(sectionId: string | null) {
    if (!draggingFolderId) return;
    if (hasPendingCreation(draggingFolderId, sectionId)) return clearFolderDrag();
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
      "폴더 이동에 실패했습니다.", false,
      (result) => {
        const saved = result as Folder | undefined;
        if (!saved) return;
        setFolders((current) => current.map((item) => item.id === source.id && folderSectionId(item) === sectionId && item.position === nextPosition
          ? { ...item, position: saved.position } : item));
      }
    );
    clearFolderDrag();
  }

  function dropFolder(targetId: string, event: { clientY: number; currentTarget: EventTarget }) {
    if (!draggingFolderId) return;
    const source = folders.find((folder) => folder.id === draggingFolderId);
    const target = folders.find((folder) => folder.id === targetId);
    if (!source || !target || source.id === target.id) return clearFolderDrag();
    const destSectionId = folderSectionId(target);
    const destScoped = folders
      .filter((folder) => folderSectionId(folder) === destSectionId)
      .sort((a, b) => a.position - b.position);
    if (hasPendingCreation(source.id, destSectionId, ...destScoped.map((item) => item.id))) return clearFolderDrag();
    const targetIndex = destScoped.findIndex((folder) => folder.id === targetId);
    const rect = event.currentTarget instanceof Element ? event.currentTarget.getBoundingClientRect() : null;
    const insertIndex = folderInsert?.id === targetId
      ? (folderInsert.edge === "before" ? targetIndex : targetIndex + 1)
      : insertIndexFromPointer(event.clientY, rect, targetIndex);
    if (folderSectionId(source) === destSectionId) {
      const moved = moveToIndex(destScoped, source.id, insertIndex);
      const changes = getPositionChanges(destScoped, moved);
      if (changes.length) {
        persistOptimisticMutation(
          `reorder:folders:${destSectionId ?? NO_SECTION}`,
          () => setFolders((current) => applyPositions(current, moved)),
          () => setFolders((current) => updateMatchingPositions(current, changes, "rollback")),
          () => apiRequest<void>("/api/folders/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
          "폴더 순서 저장에 실패했습니다.",
          true
        );
      }
      clearFolderDrag();
      return;
    }
    const destWithout = destScoped.filter((folder) => folder.id !== source.id);
    const nextDest = [...destWithout];
    nextDest.splice(Math.max(0, Math.min(insertIndex, nextDest.length)), 0, { ...source, sectionId: destSectionId });
    const destMoved = normalizePositions(nextDest);
    const previousFolders = folders;
    const optimisticFolders = normalizeFolderPositions(applyPositions(
      folders.map((folder) => folder.id === source.id ? { ...folder, sectionId: destSectionId } : folder), destMoved
    ));
    persistOptimisticMutation(
      `move:folder:${source.id}`,
      () => setFolders((current) => normalizeFolderPositions(applyPositions(
        current.map((folder) => folder.id === source.id ? { ...folder, sectionId: destSectionId } : folder),
        destMoved
      ))),
      () => setFolders((current) => rollbackCollectionChange(current, previousFolders, optimisticFolders)),
      async () => {
        await apiRequest<Folder>(`/api/folders/${source.id}`, { method: "PATCH", body: JSON.stringify({ sectionId: destSectionId }) });
        await apiRequest<void>("/api/folders/reorder", { method: "POST", body: JSON.stringify(destMoved.map(({ id, position }) => ({ id, position }))) });
      },
      "폴더 이동에 실패했습니다.",
      true
    );
    clearFolderDrag();
  }

  function dropSection(targetId: string, event: { clientY: number; currentTarget: EventTarget }) {
    if (!draggingSectionId) return;
    if (hasPendingCreation(...sections.map((item) => item.id))) { setDraggingSectionId(null); return; }
    const targetIndex = orderedSections.findIndex((section) => section.id === targetId);
    if (targetIndex < 0) return;
    const rect = event.currentTarget instanceof Element ? event.currentTarget.getBoundingClientRect() : null;
    const insertIndex = sectionInsertEdge
      ? (sectionInsertEdge === "before" ? targetIndex : targetIndex + 1)
      : insertIndexFromPointer(event.clientY, rect, targetIndex);
    const moved = moveToIndex(orderedSections, draggingSectionId, insertIndex);
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
    setSectionInsertEdge(null);
  }

  function dropFolderSection(targetId: string, event: { clientY: number; currentTarget: EventTarget }) {
    if (!draggingFolderSectionId) return;
    const source = folderSections.find((section) => section.id === draggingFolderSectionId);
    const target = folderSections.find((section) => section.id === targetId);
    if (!source || !target || source.folderId !== target.folderId) return clearFolderSectionDrag();
    const scoped = folderSections.filter((section) => section.folderId === source.folderId).sort((a, b) => a.position - b.position);
    if (hasPendingCreation(...scoped.map((item) => item.id))) return clearFolderSectionDrag();
    const targetIndex = scoped.findIndex((section) => section.id === targetId);
    const rect = event.currentTarget instanceof Element ? event.currentTarget.getBoundingClientRect() : null;
    const insertIndex = folderSectionInsert?.id === targetId
      ? (folderSectionInsert.edge === "before" ? targetIndex : targetIndex + 1)
      : insertIndexFromPointer(event.clientY, rect, targetIndex);
    const moved = moveToIndex(scoped, source.id, insertIndex);
    const changes = getPositionChanges(scoped, moved);
    if (changes.length) {
      persistOptimisticMutation(
        `reorder:folder-sections:${source.folderId}`,
        () => setFolderSections((current) => applyPositions(current, moved)),
        () => setFolderSections((current) => updateMatchingPositions(current, changes, "rollback")),
        () => apiRequest<void>("/api/folder-sections/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
        "섹션 순서 저장에 실패했습니다.",
        true
      );
    }
    clearFolderSectionDrag();
  }

  function dropBookmark(targetId: string, event: { clientY: number; currentTarget: EventTarget }) {
    if (!draggingBookmarkId) return;
    const source = bookmarks.find((bookmark) => bookmark.id === draggingBookmarkId);
    const target = bookmarks.find((bookmark) => bookmark.id === targetId);
    if (!source || !target || source.id === target.id || !target.folderId) return clearBookmarkDrag();
    const destFolderId = target.folderId;
    const destSectionId = bookmarkFolderSectionId(target);
    const destScoped = bookmarks
      .filter((bookmark) => bookmark.folderId === destFolderId && bookmarkFolderSectionId(bookmark) === destSectionId)
      .sort((a, b) => a.position - b.position);
    if (hasPendingCreation(source.id, destFolderId, destSectionId, ...destScoped.map((item) => item.id))) return clearBookmarkDrag();
    const targetIndex = destScoped.findIndex((bookmark) => bookmark.id === targetId);
    const rect = event.currentTarget instanceof Element ? event.currentTarget.getBoundingClientRect() : null;
    const insertIndex = bookmarkInsert?.id === targetId
      ? (bookmarkInsert.edge === "before" ? targetIndex : targetIndex + 1)
      : insertIndexFromPointer(event.clientY, rect, targetIndex);
    if (source.folderId === destFolderId && bookmarkFolderSectionId(source) === destSectionId) {
      const moved = moveToIndex(destScoped, source.id, insertIndex);
      const changes = getPositionChanges(destScoped, moved);
      if (changes.length) {
        persistOptimisticMutation(
          `reorder:bookmarks:${source.folderId}:${destSectionId ?? NO_SECTION}`,
          () => setBookmarks((current) => applyPositions(current, moved)),
          () => setBookmarks((current) => updateMatchingPositions(current, changes, "rollback")),
          () => apiRequest<void>("/api/bookmarks/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
          "북마크 순서 저장에 실패했습니다.",
          true
        );
      }
      clearBookmarkDrag();
      return;
    }
    relocateBookmark(source, destFolderId, destSectionId, insertIndex);
  }

  function dropBookmarkOnFolder(folderId: string) {
    if (!draggingBookmarkId) return;
    const source = bookmarks.find((bookmark) => bookmark.id === draggingBookmarkId);
    if (!source) return clearBookmarkDrag();
    if (source.folderId === folderId && bookmarkFolderSectionId(source) === null) return clearBookmarkDrag();
    relocateBookmark(source, folderId, null);
  }

  function relocateBookmark(
    source: BookmarkItem,
    folderId: string,
    nextFolderSectionId: string | null,
    insertIndex?: number
  ) {
    if (hasPendingCreation(source.id, folderId, nextFolderSectionId)) return clearBookmarkDrag();
    if (source.folderId === folderId && bookmarkFolderSectionId(source) === nextFolderSectionId && insertIndex === undefined) {
      clearBookmarkDrag();
      return;
    }
    const destWithout = bookmarks
      .filter((bookmark) => (
        bookmark.id !== source.id
        && bookmark.folderId === folderId
        && bookmarkFolderSectionId(bookmark) === nextFolderSectionId
      ))
      .sort((a, b) => a.position - b.position);
    if (hasPendingCreation(...destWithout.map((item) => item.id))) return clearBookmarkDrag();
    const nextDest = [...destWithout];
    nextDest.splice(Math.max(0, Math.min(insertIndex ?? nextDest.length, nextDest.length)), 0, {
      ...source,
      folderId,
      folderSectionId: nextFolderSectionId
    });
    const destMoved = normalizePositions(nextDest);
    const body = source.folderId === folderId
      ? { folderSectionId: nextFolderSectionId }
      : { folderId, folderSectionId: nextFolderSectionId };
    const previousBookmarks = bookmarks;
    const optimisticBookmarks = applyPositions(
      bookmarks.map((bookmark) => bookmark.id === source.id ? { ...bookmark, folderId, folderSectionId: nextFolderSectionId } : bookmark), destMoved
    );
    persistOptimisticMutation(
      `move:bookmark:${source.id}`,
      () => setBookmarks((current) => applyPositions(
        current.map((bookmark) => bookmark.id === source.id ? { ...bookmark, folderId, folderSectionId: nextFolderSectionId } : bookmark),
        destMoved
      )),
      () => setBookmarks((current) => rollbackCollectionChange(current, previousBookmarks, optimisticBookmarks)),
      async () => {
        const saved = await apiRequest<BookmarkItem>(`/api/bookmarks/${source.id}`, { method: "PATCH", body: JSON.stringify(body) });
        if (insertIndex !== undefined && destMoved.length > 1) {
          await apiRequest<void>("/api/bookmarks/reorder", {
            method: "POST",
            body: JSON.stringify(destMoved.map(({ id, position }) => ({ id, position })))
          });
        }
        return insertIndex === undefined ? saved : undefined;
      },
      "북마크 이동에 실패했습니다.",
      true,
      (result) => {
        const saved = result as BookmarkItem | undefined;
        const optimistic = destMoved.find((item) => item.id === source.id);
        if (!saved || !optimistic) return;
        setBookmarks((current) => current.map((item) => item.id === source.id && item.folderId === folderId
          && bookmarkFolderSectionId(item) === nextFolderSectionId && item.position === optimistic.position
          ? { ...item, position: saved.position } : item));
      }
    );
    clearBookmarkDrag();
  }

  function moveBookmarkToSection(source: BookmarkItem, nextFolderSectionId: string | null) {
    if (source.folderId === null) {
      clearBookmarkDrag();
      return;
    }
    relocateBookmark(source, source.folderId, nextFolderSectionId);
  }

  function duplicateBookmark(bookmark: BookmarkItem) {
    if (hasPendingCreation(bookmark.id, bookmark.folderId, bookmarkFolderSectionId(bookmark))) return;
    const payload = {
      title: `${bookmark.title} copy`,
      url: bookmark.url,
      description: bookmark.description,
      folderId: bookmark.folderId,
      folderSectionId: bookmarkFolderSectionId(bookmark),
      isFavorite: bookmark.isFavorite
    };
    const tempId = createId("bm");
    const optimistic = {
      id: tempId,
      ...payload,
      position: bookmarks.filter((item) => (
        item.folderId === payload.folderId
        && bookmarkFolderSectionId(item) === payload.folderSectionId
      )).length
    };
    if (persistRemoteRef.current) pendingCreates.current.add(tempId);
    persistOptimisticMutation(
      `duplicate:${bookmark.id}:${tempId}`,
      () => setBookmarks((current) => upsertOptimistic(current, optimistic, false)),
      () => setBookmarks((current) => current.filter((item) => item.id !== tempId)),
      async () => {
        try {
          const created = await apiRequest<BookmarkItem>("/api/bookmarks", { method: "POST", body: JSON.stringify(payload) });
          setBookmarks((current) => current.map((item) => item.id === tempId ? created : item));
        } finally { pendingCreates.current.delete(tempId); }
      },
      "북마크 복제에 실패했습니다."
    );
  }

  function toggleFavorite(id: string) {
    if (hasPendingCreation(id)) return;
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
    setSectionInsertEdge(null);
    setFolderInsert(null);
    setDragStatus("");
  }

  function clearFolderSectionDrag() {
    setDraggingFolderSectionId(null);
    setFolderSectionInsert(null);
    setDragStatus("");
  }

  function clearBookmarkDrag() {
    setDraggingBookmarkId(null);
    setBookmarkInsert(null);
    setBookmarkGroupTarget(null);
    setDragOverFolderId(null);
    setDragStatus("");
  }

  function clearDropTarget() {
    setDragOverFolderId(null);
    setDragOverSectionId(null);
    setSectionInsertEdge(null);
    setFolderInsert(null);
    setFolderSectionInsert(null);
    setBookmarkInsert(null);
    setBookmarkGroupTarget(null);
    setDragStatus("");
  }

  if (!hasHydratedData) return <BookmarksLoading />;

  const sidebarProps = {
    folders: orderedFolders,
    sections: orderedSections,
    bookmarks,
    favoriteOnly,
    selection,
    draggingFolderId,
    draggingSectionId,
    draggingBookmarkId,
    dragOverFolderId,
    dragOverSectionId,
    folderInsert,
    sectionInsertEdge,
    movePreview,
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
    mutationsDisabled,
    onDragFolder: (id: string | null) => {
      if (!mutationsDisabled) setDraggingFolderId(id);
      if (!id) clearFolderDrag();
    },
    onDragSection: (id: string | null) => {
      if (!mutationsDisabled) setDraggingSectionId(id);
      if (!id) {
        clearDropTarget();
      } else {
        setDragOverFolderId(null);
      }
    },
    onDragOverFolder: (id: string | null, edge?: "before" | "after") => {
      if (id === draggingFolderId) return clearDropTarget();
      if (draggingBookmark?.folderId === id && bookmarkFolderSectionId(draggingBookmark) === null) return clearDropTarget();
      setBookmarkInsert(null);
      setBookmarkGroupTarget(null);
      setDragOverFolderId(id);
      if (!id) {
        setFolderInsert(null);
        return;
      }
      const folder = folders.find((item) => item.id === id);
      if (draggingBookmarkId) {
        setFolderInsert(null);
        setDragOverSectionId(null);
        setSectionInsertEdge(null);
        if (folder) announceDrop(`${folder.name}으로 이동합니다.`);
        return;
      }
      if (edge) {
        setFolderInsert({ id, edge });
        setDragOverSectionId(null);
        setSectionInsertEdge(null);
        if (folder) announceDrop(`${folder.name} ${edge === "before" ? "앞" : "뒤"}에 놓습니다.`);
      }
    },
    onDragOverSection: (id: string | null, edge?: "before" | "after") => {
      const source = folders.find((item) => item.id === draggingFolderId);
      if (id === draggingSectionId || (source && !edge && folderSectionId(source) === (id === NO_SECTION ? null : id))) return clearDropTarget();
      setDragOverSectionId(id);
      setSectionInsertEdge(edge ?? null);
      if (id) {
        setDragOverFolderId(null);
        setFolderInsert(null);
      }
      if (draggingFolderId && id && !edge) {
        const name = id === "__none__" ? "섹션 없음" : sections.find((section) => section.id === id)?.name;
        if (name) announceDrop(`${name}으로 이동합니다.`);
      }
      if (draggingSectionId && id && edge) {
        const name = sections.find((section) => section.id === id)?.name;
        if (name) announceDrop(`${name} ${edge === "before" ? "앞" : "뒤"}에 놓습니다.`);
      }
    },
    onDropFolder: dropFolder,
    onDropFolderOnSection: moveFolderToSection,
    onDropBookmarkOnFolder: dropBookmarkOnFolder,
    onDropSection: dropSection
  };

  return (
    <div className="dot-shell flex h-full min-h-0 overflow-hidden" aria-busy={!hasHydratedData}
      onDragOver={(event) => { if (isDragging && !event.defaultPrevented) clearDropTarget(); }}
      onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) clearDropTarget(); }}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">{dragStatus}</div>
      {movePreview ? <MovePreview preview={movePreview} floating /> : null}
      <ConsoleSidebar {...sidebarProps} className="hidden lg:flex" />
      {mobileFoldersOpen ? (
        <div ref={mobileFoldersRef} className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="북마크 메뉴">
          <button type="button" tabIndex={-1} aria-label="폴더 메뉴 닫기" className="absolute inset-0 bg-black/30" onClick={() => setMobileFoldersOpen(false)} />
          <ConsoleSidebar {...sidebarProps} id="mobile-console-sidebar" className="absolute inset-y-0 left-0 flex shadow-2xl" />
        </div>
      ) : null}

      <section inert={mobileFoldersOpen} className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="dot-header shrink-0 border-b border-border px-3 py-2 lg:hidden">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className={BOOKMARK_TOUCH_TARGET_CLASS} onClick={() => setMobileFoldersOpen(true)} aria-controls="mobile-console-sidebar" aria-expanded={mobileFoldersOpen}>
              <Menu className="h-5 w-5" /><span className="sr-only">폴더 메뉴 열기</span>
            </Button>
            <PageTitle name={activeName} color={activeColor} count={currentCount} />
            <FavoriteButton compact count={favoriteCount} active={favoriteOnly} onClick={() => setFavoriteOnly((value) => !value)} />
            <Button size="icon" className={BOOKMARK_TOUCH_TARGET_CLASS} disabled={mutationsDisabled || !visibleFolders.length} onClick={() => openBookmarkDialog()} aria-label="새 북마크 추가">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
          <SearchBox query={query} setQuery={setQuery} className="mt-2" />
        </header>
        <header className={cn("dot-header hidden shrink-0 grid-cols-[minmax(0,1fr)_minmax(10rem,1.5fr)_auto] items-center gap-3 border-b border-border px-5 lg:grid", BOOKMARK_APP_HEADER_CLASS)}>
          <PageTitle name={activeName} color={activeColor} count={currentCount} />
          <SearchBox query={query} setQuery={setQuery} />
          <div className="flex items-center gap-2">
            <FavoriteButton count={favoriteCount} active={favoriteOnly} onClick={() => setFavoriteOnly((value) => !value)} />
            {selectedFolder ? (
              <Button variant="outline" disabled={mutationsDisabled} onClick={() => openFolderSectionDialog(undefined, selectedFolder.id)}>
                <Plus data-icon="inline-start" />섹션 추가
              </Button>
            ) : null}
            <Button disabled={mutationsDisabled || !visibleFolders.length} onClick={() => openBookmarkDialog()}>
              <Plus data-icon="inline-start" />북마크 추가
            </Button>
          </div>
        </header>

        <main
          id="bookmark-content"
          tabIndex={-1}
          className="dot-stage min-h-0 flex-1 overflow-y-auto"
          onDragOver={(event) => {
            if (!draggingBookmarkId && !draggingFolderSectionId) return;
            scrollFromPointer(event.currentTarget, event.clientY);
          }}
        >
          <div className="mx-auto w-full max-w-[1480px] flex flex-col gap-6 p-[clamp(0.75rem,2vw,2rem)]">
            {hydrated && !apiBacked && !refreshing ? (
              <div role="status" className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                {cacheWritable
                  ? "서버에 연결하지 못했습니다. 변경 사항은 이 기기에만 저장됩니다. 다시 연결하면 로컬 변경은 서버 데이터로 교체됩니다."
                  : "서버에 연결하지 못했고 브라우저 저장소를 사용할 수 없습니다. 변경 사항은 현재 화면에만 유지됩니다. 새로고침하거나 창을 닫으면 사라집니다."}
              </div>
            ) : null}
            {pendingWrites > 0 ? <DatabaseProgressStatus title={pendingDeletes > 0 ? "데이터베이스에서 삭제 중" : "데이터베이스에 저장 중"} /> : null}
            {mutationError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">{mutationError}</div> : null}
            {groups.length === 0 || (filtered.length === 0 && hasActiveFilter) ? (
              <div className="dot-empty flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 text-center">
                {showFolderEmptyState
                  ? <FolderPlus className="size-8 text-muted-foreground" aria-hidden="true" />
                  : <Bookmark className="size-8 text-muted-foreground" aria-hidden="true" />}
                <p className="font-medium text-foreground">
                  {showFolderEmptyState
                    ? folderEmptyMessage
                    : query.trim() && favoriteOnly
                    ? "검색어와 즐겨찾기 조건에 맞는 북마크가 없습니다."
                    : query.trim()
                      ? "검색 결과가 없습니다."
                      : favoriteOnly
                        ? "즐겨찾기한 북마크가 없습니다."
                        : "북마크가 없습니다."}
                </p>
                {showFolderEmptyState ? (
                  <Button type="button" disabled={mutationsDisabled} onClick={() => openFolderDialog()}>
                    <Plus data-icon="inline-start" aria-hidden="true" />
                    {folderCreateLabel}
                  </Button>
                ) : hasActiveFilter ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setQuery(""); setFavoriteOnly(false); }}>
                    필터 초기화
                  </Button>
                ) : null}
              </div>
            ) : groups.map((group) => (
              <section key={group.key} className="flex flex-col gap-3">
                <div
                  className={cn(
                    BOOKMARK_SECTION_HEADER_CLASS,
                    "dot-section-header relative",
                    draggingFolderSectionId === group.folderSection?.id && "opacity-60",
                    draggingBookmarkId && "ring-1 ring-transparent hover:ring-ring/30",
                    folderSectionInsert?.id && folderSectionInsert.id === group.folderSection?.id && folderSectionInsert.edge === "before" && "shadow-[inset_0_2px_0_0_hsl(var(--primary))]",
                    folderSectionInsert?.id && folderSectionInsert.id === group.folderSection?.id && folderSectionInsert.edge === "after" && "shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                  )}
                  draggable={Boolean(group.folderSection) && !mutationsDisabled}
                  onDragStart={(event) => {
                    if (!group.folderSection || mutationsDisabled) return;
                    clearDropTarget();
                    event.dataTransfer?.setData("text/plain", group.folderSection.id);
                    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
                    setDraggingFolderSectionId(group.folderSection.id);
                  }}
                  onDragEnd={clearFolderSectionDrag}
                  onDragOver={(event) => {
                    if (draggingFolderSectionId && group.folderSection) {
                      if (draggingFolderSection?.folderId !== group.folder.id || draggingFolderSectionId === group.folderSection.id) {
                        event.stopPropagation();
                        clearDropTarget();
                        if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
                        return;
                      }
                      event.preventDefault();
                      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                      const rect = event.currentTarget.getBoundingClientRect();
                      const edge = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                      setFolderSectionInsert({ id: group.folderSection.id, edge });
                      announceDrop(`${group.label} ${edge === "before" ? "앞" : "뒤"}에 놓습니다.`);
                      return;
                    }
                    if (!draggingBookmarkId) return;
                    event.preventDefault();
                    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                    clearDropTarget();
                    if (draggingBookmark?.folderId === group.folder.id && bookmarkFolderSectionId(draggingBookmark) === (group.folderSection?.id ?? null)) return;
                    setBookmarkGroupTarget(group.key);
                    announceDrop(`${group.label}으로 이동합니다.`);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggingFolderSectionId && group.folderSection) {
                      dropFolderSection(group.folderSection.id, event);
                      return;
                    }
                    const source = bookmarks.find((item) => item.id === draggingBookmarkId);
                    if (!source || !group.folder.id) return clearBookmarkDrag();
                    if (source.folderId !== group.folder.id) {
                      relocateBookmark(source, group.folder.id, group.folderSection?.id ?? null);
                      return;
                    }
                    moveBookmarkToSection(source, group.folderSection?.id ?? null);
                  }}
                >
                  {movePreview && folderSectionInsert?.id === group.folderSection?.id && draggingFolderSectionId ? <DropPreview {...movePreview} edge={folderSectionInsert?.edge} /> : null}
                  <span data-folder-color={group.folderSection?.color ?? group.folder.color ?? COLOR_FALLBACK} className="dot-marker" style={{ backgroundColor: group.folderSection?.color ?? group.folder.color ?? COLOR_FALLBACK }} aria-hidden="true" />
                  <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{group.label}</h2>
                  <Badge variant="secondary" className="tabular-nums">{group.items.length}</Badge>
                  {group.folderSection ? (
                    <FolderSectionActionsMenu
                      folderSection={group.folderSection}
                      mutationsDisabled={mutationsDisabled || pendingCreates.current.has(group.folderSection.id)}
                      onAddBookmark={(folderSection) => openBookmarkDialogInSection(group.folder, folderSection)}
                      onEdit={openFolderSectionDialog}
                      onDelete={(folderSection) => setDeleteTarget({ type: "folderSection", id: folderSection.id })}
                    />
                  ) : (
                    <FolderActionsMenu
                      folder={group.folder}
                      mutationsDisabled={mutationsDisabled || pendingCreates.current.has(group.folder.id)}
                      onAddBookmark={(folder) => openBookmarkDialogInSection(folder, null)}
                      onEdit={openFolderDialog}
                      onDelete={(folder) => setDeleteTarget({ type: "folder", id: folder.id })}
                    />
                  )}
                </div>
                <div
                  className={cn("relative grid min-h-12 grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4", bookmarkGroupTarget === group.key && "rounded-2xl ring-2 ring-primary/30")}
                  aria-label={`${group.label} 북마크, 드래그해서 위치 변경`}
                  onDragOver={(event) => {
                    if (!draggingBookmarkId) return;
                    event.preventDefault();
                    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                    clearDropTarget();
                    setBookmarkGroupTarget(group.key);
                    announceDrop(`${group.label}으로 이동합니다.`);
                  }}
                  onDrop={(event) => {
                    if (!draggingBookmarkId) return;
                    event.preventDefault();
                    const source = bookmarks.find((item) => item.id === draggingBookmarkId);
                    if (!source) return clearBookmarkDrag();
                    if (
                      source.folderId === group.folder.id
                      && bookmarkFolderSectionId(source) === (group.folderSection?.id ?? null)
                    ) {
                      const scoped = bookmarks
                        .filter((item) => item.folderId === source.folderId && bookmarkFolderSectionId(item) === bookmarkFolderSectionId(source))
                        .sort((a, b) => a.position - b.position);
                      const moved = moveToIndex(scoped, source.id, scoped.length);
                      const changes = getPositionChanges(scoped, moved);
                      if (hasPendingCreation(...scoped.map((item) => item.id))) return clearBookmarkDrag();
                      if (changes.length) {
                        persistOptimisticMutation(
                          `reorder:bookmarks:${source.folderId}:${bookmarkFolderSectionId(source) ?? NO_SECTION}`,
                          () => setBookmarks((current) => applyPositions(current, moved)),
                          () => setBookmarks((current) => updateMatchingPositions(current, changes, "rollback")),
                          () => apiRequest<void>("/api/bookmarks/reorder", { method: "POST", body: JSON.stringify(moved.map(({ id, position }) => ({ id, position }))) }),
                          "북마크 순서 저장에 실패했습니다.",
                          true
                        );
                      }
                      clearBookmarkDrag();
                      return;
                    }
                    relocateBookmark(source, group.folder.id, group.folderSection?.id ?? null);
                  }}
                >
                  {group.items.map((bookmark) => (
                    <BookmarkCard
                      key={bookmark.id}
                      bookmark={bookmark}
                      dragging={draggingBookmarkId === bookmark.id}
                      dropEdge={bookmarkInsert?.id === bookmark.id ? bookmarkInsert.edge : null}
                      canDrop={Boolean(draggingBookmarkId && draggingBookmarkId !== bookmark.id)}
                      preview={bookmarkInsert?.id === bookmark.id ? movePreview : null}
                      mutationsDisabled={mutationsDisabled || pendingCreates.current.has(bookmark.id)}
                      onDragStart={(id) => { clearDropTarget(); setDraggingBookmarkId(id); }}
                      onDragEnd={clearBookmarkDrag}
                      onDragOver={(id, event) => {
                        if (id === draggingBookmarkId) { clearDropTarget(); return; }
                        const rect = event.currentTarget.getBoundingClientRect();
                        const edge = insertEdgeFromPointer(event.clientY, rect);
                        clearDropTarget();
                        setBookmarkInsert({ id, edge });
                        const target = bookmarks.find((item) => item.id === id);
                        if (target) announceDrop(`${target.title} ${edge === "before" ? "앞" : "뒤"}에 놓습니다.`);
                      }}
                      onDrop={dropBookmark}
                      onEdit={openBookmarkDialog}
                      onDuplicate={duplicateBookmark}
                      onDelete={(item) => setDeleteTarget({ type: "bookmark", id: item.id })}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                  {movePreview && bookmarkGroupTarget === group.key ? <div className="pointer-events-none relative min-h-[136px]"><DropPreview {...movePreview} variant="card" /></div> : null}
                </div>
              </section>
            ))}
          </div>
        </main>
      </section>

      {bookmarkDialog ? (
        <Modal title={bookmarkDialog.mode === "edit" ? "북마크 편집" : "북마크 추가"} onClose={() => setBookmarkDialog(null)}>
          <form className="flex flex-col gap-4" onSubmit={saveBookmark}>
            <Field label="URL"><Input type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={bookmarkDraft.url} onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, url: event.target.value }))} /></Field>
            <Field label="제목"><Input value={bookmarkDraft.title} onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, title: event.target.value }))} /></Field>
            <Field label="설명"><Textarea value={bookmarkDraft.description} onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, description: event.target.value }))} rows={2} /></Field>
            <Field label="폴더">
              <Select value={bookmarkDraft.folderId} onValueChange={(folderId) => setBookmarkDraft((draft) => ({ ...draft, folderId, folderSectionId: NO_SECTION }))}>
                <SelectTrigger className="w-full" aria-label="폴더"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>{orderedFolders.map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>
            <Field label="섹션">
              <Select value={bookmarkDraft.folderSectionId} onValueChange={(folderSectionId) => setBookmarkDraft((draft) => ({ ...draft, folderSectionId }))}>
                <SelectTrigger className="w-full" aria-label="섹션"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>
                  <SelectItem value={NO_SECTION}>섹션 없음</SelectItem>
                  {folderSectionsForDraft.map((section) => <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={bookmarkDraft.isFavorite} onChange={(event) => setBookmarkDraft((draft) => ({ ...draft, isFavorite: event.target.checked }))} />즐겨찾기</label>
            {bookmarkDraftPreview ? <MovePreview preview={bookmarkDraftPreview} /> : null}
            <FormFooter error={formError} onCancel={() => setBookmarkDialog(null)} />
          </form>
        </Modal>
      ) : null}

      {folderDialog ? (
        <Modal title={folderDialog.mode === "edit" ? "폴더 편집" : "새 폴더"} onClose={() => setFolderDialog(null)}>
          <form className="flex flex-col gap-4" onSubmit={saveFolder}>
            <Field label="이름"><Input value={folderDraft.name} onChange={(event) => setFolderDraft((draft) => ({ ...draft, name: event.target.value }))} /></Field>
            <Field label="섹션">
              <Select value={folderDraft.sectionId} onValueChange={(sectionId) => setFolderDraft((draft) => ({ ...draft, sectionId }))}>
                <SelectTrigger className="w-full" aria-label="섹션"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>
                  <SelectItem value={NO_SECTION}>섹션 없음</SelectItem>
                  {orderedSections.map((section) => <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
            </Field>
            <ColorPicker color={folderDraft.color} onChange={(color) => setFolderDraft((draft) => ({ ...draft, color }))} />
            {folderDraftPreview ? <MovePreview preview={folderDraftPreview} /> : null}
            <FormFooter error={formError} onCancel={() => setFolderDialog(null)} />
          </form>
        </Modal>
      ) : null}

      {sectionDialog ? (
        <Modal title={sectionDialog.mode === "edit" ? "섹션 편집" : "새 섹션"} onClose={() => setSectionDialog(null)}>
          <form className="flex flex-col gap-4" onSubmit={saveSection}>
            <Field label="이름"><Input value={sectionDraft.name} onChange={(event) => setSectionDraft((draft) => ({ ...draft, name: event.target.value }))} /></Field>
            <ColorPicker color={sectionDraft.color} allowDefault onChange={(color) => setSectionDraft((draft) => ({ ...draft, color }))} />
            <FormFooter error={formError} onCancel={() => setSectionDialog(null)} />
          </form>
        </Modal>
      ) : null}

      {folderSectionDialog ? (
        <Modal title={folderSectionDialog.mode === "edit" ? "섹션 편집" : "새 섹션"} onClose={() => setFolderSectionDialog(null)}>
          <form className="flex flex-col gap-4" onSubmit={saveFolderSection}>
            <Field label="이름"><Input value={folderSectionDraft.name} onChange={(event) => setFolderSectionDraft((draft) => ({ ...draft, name: event.target.value }))} /></Field>
            <ColorPicker color={folderSectionDraft.color} allowDefault onChange={(color) => setFolderSectionDraft((draft) => ({ ...draft, color }))} />
            <FormFooter error={formError} onCancel={() => setFolderSectionDialog(null)} />
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title={`${deleteTarget.type === "bookmark" ? "북마크" : deleteTarget.type === "folder" ? "폴더" : "섹션"} 삭제`} onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-muted-foreground">
            {deleteTarget.type === "folderSection"
              ? "이 섹션을 삭제합니다. 북마크는 삭제되지 않고 섹션 없음으로 이동합니다."
              : deleteTarget.type === "section"
              ? "이 섹션을 삭제합니다. 소속 폴더는 삭제되지 않고 섹션 없음으로 이동합니다."
              : deleteTarget.type === "folder"
                ? "이 폴더를 삭제하고 북마크는 다른 폴더로 이동합니다."
                : "이 북마크를 삭제합니다."}
          </p>
          {deleteError ? <p className="mt-4 text-sm font-bold text-destructive">{deleteError}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              삭제
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
      <span className="dot-marker" style={{ backgroundColor: color }} aria-hidden="true" />
      <h1 className="truncate text-lg font-bold tracking-tight text-foreground">{name}</h1>
      <Badge variant="secondary" className="tabular-nums">{count}</Badge>
    </div>
  );
}

function SearchBox({ query, setQuery, className }: { query: string; setQuery: (value: string) => void; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function clearSearch() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input ref={inputRef} aria-label="북마크 검색" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
        if (event.key === "Escape" && query && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.stopPropagation();
          clearSearch();
        }
      }} placeholder="북마크 검색..." className="pl-9 pr-12 lg:pr-10" />
      {query ? <Button type="button" variant="ghost" size="icon" aria-label="검색어 지우기" onClick={clearSearch} className="absolute right-0 top-1/2 size-10 -translate-y-1/2 lg:size-8"><X /></Button> : null}
    </div>
  );
}

function FavoriteButton({ count, active, onClick, compact = false }: { count: number; active: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <Button variant={active ? "secondary" : "outline"} size={compact ? "icon" : "default"} aria-pressed={active} aria-label={`즐겨찾기 ${count}개만 보기`} onClick={onClick} className={compact ? BOOKMARK_TOUCH_TARGET_CLASS : undefined}>
      <Star data-icon="inline-start" className={cn(active && "fill-current")} />{compact ? null : <>즐겨찾기 <span>{count}</span></>}
    </Button>
  );
}

function ColorPicker({ color, onChange, allowDefault = false }: { color: string | null; onChange: (color: string | null) => void; allowDefault?: boolean }) {
  return (
    <Field label="색상">
      <div className="flex flex-wrap gap-2">
        {allowDefault ? <Button type="button" variant={color === null ? "secondary" : "outline"} size="sm" aria-pressed={color === null} onClick={() => onChange(null)}>기본</Button> : null}
        {COLOR_OPTIONS.map((option) => <button key={option} type="button" aria-label={`색상 ${option}`} aria-pressed={color === option} onClick={() => onChange(option)} className={cn("size-8 rounded-md border border-input outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", color === option && "ring-2 ring-ring ring-offset-2 ring-offset-background")} style={{ backgroundColor: option }} />)}
      </div>
    </Field>
  );
}

function FormFooter({ error, onCancel }: { error: string; onCancel: () => void }) {
  return (
    <>
      {error ? <p className="text-sm font-bold text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
        <Button type="submit">저장</Button>
      </div>
    </>
  );
}
