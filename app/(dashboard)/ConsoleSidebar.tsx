"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  Trash2
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { countBookmarks } from "@/app/lib/bookmarks/counts";
import { buildFolderTree, folderParentId, type FolderTreeNode } from "@/app/lib/bookmarks/folder-tree";
import { BRAND } from "@/app/lib/config/brand";
import type { BookmarkItem, Folder } from "@/app/lib/bookmarks/types";
import { cn } from "@/lib/utils";

export type ConsoleSidebarProps = {
  folders: Folder[];
  bookmarks: BookmarkItem[];
  favoriteOnly: boolean;
  selectedFolderId: string;
  draggingFolderId: string | null;
  dragOverFolderId: string | null;
  onSelectFolder: (id: string) => void;
  onAddFolder: (parentId?: string | null) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onRefresh: () => void;
  refreshing: boolean;
  mutationsDisabled: boolean;
  onDragFolder: (folderId: string | null) => void;
  onDragOverFolder: (folderId: string | null) => void;
  onDropFolder: (folderId: string) => void;
  className?: string;
  id?: string;
};

export function ConsoleSidebar({
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
  mutationsDisabled,
  onDragFolder,
  onDragOverFolder,
  onDropFolder,
  className,
  id
}: ConsoleSidebarProps) {
  return (
    <aside
      id={id}
      className={cn(
        "flex w-[20rem] max-w-[calc(100vw-1rem)] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[#F7F8FB] text-[var(--text-primary)] xl:w-[22rem]",
        className
      )}
      aria-label="북마크 콘솔 사이드바"
    >
      <div className="flex min-h-[var(--dashboard-header-height)] shrink-0 flex-col justify-center border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            aria-label={`${BRAND.appName} 홈으로 이동`}
            className="min-w-0 truncate rounded text-xl font-extrabold tracking-[-0.04em] text-[var(--color-brand)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50"
          >
            {BRAND.appName}
          </Link>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-white hover:text-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="북마크 새로고침"
            title="북마크 새로고침"
          >
            <RefreshCcw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" />
          </button>
        </div>
        <span className="mt-1 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">BOOKMARK CONSOLE</span>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="북마크 폴더">
        <div className="border-l border-[#E5E7EB] pl-0">
          <FolderTree
            folders={folders}
            bookmarks={bookmarks}
            favoriteOnly={favoriteOnly}
            selectedFolderId={selectedFolderId}
            draggingFolderId={draggingFolderId}
            dragOverFolderId={dragOverFolderId}
            mutationsDisabled={mutationsDisabled}
            onSelectFolder={onSelectFolder}
            onAddFolder={onAddFolder}
            onEditFolder={onEditFolder}
            onDeleteFolder={onDeleteFolder}
            onDragFolder={onDragFolder}
            onDragOverFolder={onDragOverFolder}
            onDropFolder={onDropFolder}
          />
        </div>
        <button
          type="button"
          disabled={mutationsDisabled}
          className="mr-3 mt-2 flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-bold text-[var(--text-secondary)] transition hover:bg-white hover:text-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onAddFolder(null)}
        >
          <FolderPlus className="h-4 w-4" aria-hidden="true" />
          새 폴더
        </button>
      </nav>
    </aside>
  );
}

function FolderTree({
  folders,
  bookmarks,
  favoriteOnly,
  selectedFolderId,
  draggingFolderId,
  dragOverFolderId,
  mutationsDisabled,
  onSelectFolder,
  onAddFolder,
  onEditFolder,
  onDeleteFolder,
  onDragFolder,
  onDragOverFolder,
  onDropFolder
}: Omit<ConsoleSidebarProps, "onRefresh" | "refreshing" | "className" | "id">) {
  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const treeRef = useRef<HTMLUListElement>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const treeLabelId = useId();

  useEffect(() => {
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const ancestors = new Set<string>();
    const seen = new Set<string>();
    let current = byId.get(selectedFolderId);
    while (current) {
      const parentId = folderParentId(current);
      if (!parentId || seen.has(parentId)) break;
      seen.add(parentId);
      ancestors.add(parentId);
      current = byId.get(parentId);
    }
    if (!ancestors.size) return;
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      ancestors.forEach((id) => next.add(id));
      return next.size === current.size ? current : next;
    });
  }, [folders, selectedFolderId]);

  function toggleFolder(folderId: string) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function expandFolder(folderId: string) {
    setExpandedFolderIds((current) => {
      if (current.has(folderId)) return current;
      const next = new Set(current);
      next.add(folderId);
      return next;
    });
  }

  function handleTreeKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, node: FolderTreeNode) {
    const folderButtons = Array.from(treeRef.current?.querySelectorAll<HTMLButtonElement>("[data-folder-select]") ?? []);
    const currentIndex = folderButtons.indexOf(event.currentTarget);
    const focusAt = (index: number) => folderButtons[index]?.focus();

    if (event.key === "ArrowDown" && currentIndex >= 0) {
      event.preventDefault();
      focusAt(Math.min(currentIndex + 1, folderButtons.length - 1));
      return;
    }
    if (event.key === "ArrowUp" && currentIndex >= 0) {
      event.preventDefault();
      focusAt(Math.max(currentIndex - 1, 0));
      return;
    }
    if (event.key === "ArrowRight" && node.children.length) {
      event.preventDefault();
      if (!expandedFolderIds.has(node.folder.id)) {
        toggleFolder(node.folder.id);
      } else if (currentIndex >= 0) {
        focusAt(currentIndex + 1);
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (node.children.length && expandedFolderIds.has(node.folder.id)) {
        toggleFolder(node.folder.id);
        return;
      }
      const parentId = folderParentId(node.folder);
      if (parentId) {
        folderButtons.find((button) => button.dataset.folderSelect === parentId)?.focus();
      }
    }
  }

  return (
    <div className="pb-1 pt-0.5">
      <span id={treeLabelId} className="sr-only">북마크 폴더 트리</span>
      <ul ref={treeRef} role="tree" aria-labelledby={treeLabelId} className="space-y-0.5">
        {tree.map((node) => (
          <FolderTreeRow
            key={node.folder.id}
            node={node}
            bookmarks={bookmarks}
            favoriteOnly={favoriteOnly}
            selectedFolderId={selectedFolderId}
            expandedFolderIds={expandedFolderIds}
            draggingFolderId={draggingFolderId}
            dragOverFolderId={dragOverFolderId}
            mutationsDisabled={mutationsDisabled}
            onToggleFolder={toggleFolder}
            onExpandFolder={expandFolder}
            onSelectFolder={onSelectFolder}
            onAddFolder={onAddFolder}
            onEditFolder={onEditFolder}
            onDeleteFolder={onDeleteFolder}
            onDragFolder={onDragFolder}
            onDragOverFolder={onDragOverFolder}
            onDropFolder={onDropFolder}
            onTreeKeyDown={handleTreeKeyDown}
          />
        ))}
      </ul>
    </div>
  );
}

function FolderTreeRow({
  node,
  bookmarks,
  favoriteOnly,
  selectedFolderId,
  expandedFolderIds,
  draggingFolderId,
  dragOverFolderId,
  mutationsDisabled,
  onToggleFolder,
  onExpandFolder,
  onSelectFolder,
  onAddFolder,
  onEditFolder,
  onDeleteFolder,
  onDragFolder,
  onDragOverFolder,
  onDropFolder,
  onTreeKeyDown
}: {
  node: FolderTreeNode;
  bookmarks: BookmarkItem[];
  favoriteOnly: boolean;
  selectedFolderId: string;
  expandedFolderIds: Set<string>;
  draggingFolderId: string | null;
  dragOverFolderId: string | null;
  mutationsDisabled: boolean;
  onToggleFolder: (folderId: string) => void;
  onExpandFolder: (folderId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onAddFolder: (parentId?: string | null) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onDragFolder: (folderId: string | null) => void;
  onDragOverFolder: (folderId: string | null) => void;
  onDropFolder: (folderId: string) => void;
  onTreeKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, node: FolderTreeNode) => void;
}) {
  const { folder, depth, children } = node;
  const active = folder.id === selectedFolderId;
  const hasChildren = children.length > 0;
  const expanded = expandedFolderIds.has(folder.id);
  const folderColor = folder.color ?? "#797979";
  const descendantFolderIds = new Set<string>();
  const collectFolderIds = (current: FolderTreeNode) => {
    if (descendantFolderIds.has(current.folder.id)) return;
    descendantFolderIds.add(current.folder.id);
    current.children.forEach(collectFolderIds);
  };
  collectFolderIds(node);
  const count = countBookmarks(
    bookmarks.filter((bookmark) => descendantFolderIds.has(bookmark.folderId ?? "")),
    { favoriteOnly }
  );

  return (
    <li
      role="treeitem"
      aria-level={depth}
      aria-expanded={hasChildren ? expanded : undefined}
      className={cn(
        "group/row relative",
        draggingFolderId === folder.id && "opacity-60",
        dragOverFolderId === folder.id && "rounded-md bg-indigo-50/70 ring-2 ring-[var(--color-brand)]/25"
      )}
      draggable={!mutationsDisabled}
      onDragStart={() => onDragFolder(folder.id)}
      onDragEnd={() => onDragFolder(null)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOverFolder(folder.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDropFolder(folder.id);
      }}
    >
      <div className="flex min-h-9 items-center gap-0.5" style={{ paddingLeft: `${Math.max(depth - 1, 0) * 10}px` }}>
        {hasChildren ? (
          <button
            type="button"
            className="flex h-7 w-5 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50"
            aria-label={`${folder.name} 하위 폴더 ${expanded ? "접기" : "펼치기"}`}
            aria-controls={`folder-children-${folder.id}`}
            aria-expanded={expanded}
            onClick={() => onToggleFolder(folder.id)}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden="true" />
        )}
        <button
          type="button"
          data-folder-select={folder.id}
          aria-current={active ? "page" : undefined}
          onKeyDown={(event) => onTreeKeyDown(event, node)}
          onClick={() => {
            onSelectFolder(folder.id);
            if (hasChildren) onExpandFolder(folder.id);
          }}
          className={cn(
            "flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50",
            active
              ? "bg-white text-[var(--color-brand)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              : "text-[var(--text-secondary)] hover:bg-white hover:text-[var(--text-heading)]"
          )}
        >
          {hasChildren && expanded ? (
            <FolderOpen
              data-folder-color={folderColor}
              className="h-4 w-4 shrink-0"
              style={{ color: folderColor }}
              aria-hidden="true"
            />
          ) : (
            <FolderIcon
              data-folder-color={folderColor}
              className="h-4 w-4 shrink-0"
              style={{ color: folderColor }}
              aria-hidden="true"
            />
          )}
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--text-muted)]">{count}</span>
        </button>
        <FolderActionsMenu
          folder={folder}
          mutationsDisabled={mutationsDisabled}
          onAddFolder={onAddFolder}
          onEditFolder={onEditFolder}
          onDeleteFolder={onDeleteFolder}
        />
      </div>
      {hasChildren && expanded ? (
        <ul id={`folder-children-${folder.id}`} role="group" className="space-y-0.5">
          {children.map((child) => (
            <FolderTreeRow
              key={child.folder.id}
              node={child}
              bookmarks={bookmarks}
              favoriteOnly={favoriteOnly}
              selectedFolderId={selectedFolderId}
              expandedFolderIds={expandedFolderIds}
              draggingFolderId={draggingFolderId}
              dragOverFolderId={dragOverFolderId}
              mutationsDisabled={mutationsDisabled}
              onToggleFolder={onToggleFolder}
              onExpandFolder={onExpandFolder}
              onSelectFolder={onSelectFolder}
              onAddFolder={onAddFolder}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
              onDragFolder={onDragFolder}
              onDragOverFolder={onDragOverFolder}
              onDropFolder={onDropFolder}
              onTreeKeyDown={onTreeKeyDown}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function FolderActionsMenu({
  folder,
  mutationsDisabled,
  onAddFolder,
  onEditFolder,
  onDeleteFolder
}: {
  folder: Folder;
  mutationsDisabled: boolean;
  onAddFolder: (parentId?: string | null) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={mutationsDisabled}
          aria-label={`${folder.name} 메뉴`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--text-muted)] transition hover:bg-white hover:text-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          aria-label={`${folder.name} 메뉴`}
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-[80] min-w-40 rounded-lg border border-[var(--border-subtle)] bg-white p-1 shadow-lg outline-none"
        >
          <DropdownMenu.Item
            onSelect={() => onAddFolder(folder.id)}
            className="flex h-9 cursor-pointer items-center gap-2 rounded px-3 text-sm font-medium text-[var(--text-heading)] outline-none hover:bg-[#F8FAFC] focus:bg-[#F8FAFC]"
          >
            <FolderPlus className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
            하위 폴더 추가
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => onEditFolder(folder)}
            className="flex h-9 cursor-pointer items-center gap-2 rounded px-3 text-sm font-medium text-[var(--text-heading)] outline-none hover:bg-[#F8FAFC] focus:bg-[#F8FAFC]"
          >
            <Pencil className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
            편집
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
          <DropdownMenu.Item
            onSelect={() => onDeleteFolder(folder)}
            className="flex h-9 cursor-pointer items-center gap-2 rounded px-3 text-sm font-medium text-destructive outline-none hover:bg-red-50 focus:bg-red-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            삭제
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
