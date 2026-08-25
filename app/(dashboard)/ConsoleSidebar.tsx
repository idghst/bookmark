"use client";

import Link from "next/link";
import type { DragEvent } from "react";
import {
  Folder as FolderIcon,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { countBookmarks } from "@/app/lib/bookmarks/counts";
import { buildSidebarGroups } from "@/app/lib/bookmarks/groups";
import { insertEdgeFromPointer, scrollFromPointer } from "@/app/lib/bookmarks/positions";
import { BRAND } from "@/app/lib/config/brand";
import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";
import { cn } from "@/lib/utils";

type Selection = { kind: "folder" | "section"; id: string };
type InsertEdge = "before" | "after";

export type ConsoleSidebarProps = {
  folders: Folder[];
  sections: Section[];
  bookmarks: BookmarkItem[];
  favoriteOnly: boolean;
  selection: Selection | null;
  draggingFolderId: string | null;
  draggingSectionId: string | null;
  draggingBookmarkId: string | null;
  dragOverFolderId: string | null;
  dragOverSectionId: string | null;
  folderInsert: { id: string; edge: InsertEdge } | null;
  sectionInsertEdge: InsertEdge | null;
  onSelectFolder: (id: string) => void;
  onSelectSection: (id: string) => void;
  onAddFolder: () => void;
  onAddSection: () => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onEditSection: (section: Section) => void;
  onDeleteSection: (section: Section) => void;
  onRefresh: () => void;
  refreshing: boolean;
  mutationsDisabled: boolean;
  onDragFolder: (folderId: string | null) => void;
  onDragSection: (sectionId: string | null) => void;
  onDragOverFolder: (folderId: string | null, edge?: InsertEdge) => void;
  onDragOverSection: (sectionId: string | null, edge?: InsertEdge) => void;
  onDropFolder: (folderId: string, event: DragEvent<HTMLElement>) => void;
  onDropFolderOnSection: (sectionId: string | null) => void;
  onDropBookmarkOnFolder: (folderId: string) => void;
  onDropSection: (sectionId: string, event: DragEvent<HTMLElement>) => void;
  className?: string;
  id?: string;
};

export function ConsoleSidebar(props: ConsoleSidebarProps) {
  const groups = buildSidebarGroups(props.sections, props.folders);
  return (
    <aside
      id={props.id}
      className={cn(
        "flex w-[20rem] max-w-[calc(100vw-1rem)] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[#F7F8FB] text-[var(--text-primary)] xl:w-[22rem]",
        props.className
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
            onClick={props.onRefresh}
            disabled={props.refreshing}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-white hover:text-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50 disabled:opacity-50"
            aria-label="북마크 새로고침"
          >
            <RefreshCcw className={cn("h-4 w-4", props.refreshing && "animate-spin")} aria-hidden="true" />
          </button>
        </div>
        <span className="mt-1 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">BOOKMARK CONSOLE</span>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        aria-label="북마크 폴더"
        onDragOver={(event) => {
          if (!props.draggingFolderId && !props.draggingSectionId && !props.draggingBookmarkId) return;
          scrollFromPointer(event.currentTarget, event.clientY);
        }}
      >
        <div className="space-y-4">
          {groups.map((group) => {
            const sectionId = group.section?.id ?? null;
            const sectionActive = group.section
              ? props.selection?.kind === "section" && props.selection.id === group.section.id
              : false;
            return (
              <section
                key={sectionId ?? "__none__"}
                aria-label={group.section?.name ?? "섹션 없음"}
                className={cn(
                  group.section && props.draggingSectionId === group.section.id && "opacity-60",
                  group.section && props.draggingSectionId && props.dragOverSectionId === group.section.id && props.sectionInsertEdge === "before" && "shadow-[inset_0_2px_0_0_var(--color-brand)]",
                  group.section && props.draggingSectionId && props.dragOverSectionId === group.section.id && props.sectionInsertEdge === "after" && "shadow-[inset_0_-2px_0_0_var(--color-brand)]"
                )}
                onDragOver={(event) => {
                  if (!props.draggingSectionId || !group.section) return;
                  event.preventDefault();
                  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                  scrollFromPointer(event.currentTarget.closest("nav") ?? event.currentTarget, event.clientY);
                  const rect = event.currentTarget.getBoundingClientRect();
                  props.onDragOverSection(
                    group.section.id,
                    event.clientY < rect.top + rect.height / 2 ? "before" : "after"
                  );
                }}
                onDrop={(event) => {
                  if (!props.draggingSectionId || !group.section) return;
                  event.preventDefault();
                  props.onDropSection(group.section.id, event);
                }}
              >
                {group.section ? (
                  <div
                    className={cn(
                      "group/section flex min-h-9 items-center rounded-md",
                      props.draggingFolderId && props.dragOverSectionId === group.section.id && "bg-indigo-50/70 ring-2 ring-[var(--color-brand)]/25"
                    )}
                    draggable={!props.mutationsDisabled}
                    onDragStart={(event) => {
                      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
                      props.onDragSection(group.section?.id ?? null);
                      const groupEl = event.currentTarget.closest("section");
                      if (!groupEl) return;
                      const rect = groupEl.getBoundingClientRect();
                      event.dataTransfer?.setDragImage?.(groupEl, event.clientX - rect.left, event.clientY - rect.top);
                    }}
                    onDragEnd={() => props.onDragSection(null)}
                    onDragOver={(event) => {
                      if (!props.draggingFolderId) return;
                      event.preventDefault();
                      event.stopPropagation();
                      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                      props.onDragOverSection(group.section?.id ?? null);
                    }}
                    onDrop={(event) => {
                      if (!props.draggingFolderId) return;
                      event.preventDefault();
                      event.stopPropagation();
                      props.onDropFolderOnSection(group.section?.id ?? null);
                    }}
                  >
                    <button
                      type="button"
                      aria-current={sectionActive ? "page" : undefined}
                      onClick={() => props.onSelectSection(group.section?.id ?? "")}
                      className={cn(
                        "flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-xs font-extrabold uppercase tracking-[0.06em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50",
                        sectionActive ? "bg-white text-[var(--color-brand)]" : "text-[var(--text-muted)] hover:bg-white"
                      )}
                    >
                      <span
                        className="h-3 w-1 rounded-full"
                        style={{ backgroundColor: group.section.color ?? "#797979" }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{group.section.name}</span>
                    </button>
                    <ActionsMenu
                      label={group.section.name}
                      mutationsDisabled={props.mutationsDisabled}
                      onEdit={() => props.onEditSection(group.section!)}
                      onDelete={() => props.onDeleteSection(group.section!)}
                    />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex min-h-9 items-center rounded-md px-2 text-xs font-extrabold uppercase tracking-[0.06em] text-[var(--text-muted)]",
                      props.draggingFolderId && props.dragOverSectionId === "__none__" && "bg-indigo-50/70 ring-2 ring-[var(--color-brand)]/25"
                    )}
                    onDragOver={(event) => {
                      if (!props.draggingFolderId) return;
                      event.preventDefault();
                      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                      props.onDragOverSection("__none__");
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      props.onDropFolderOnSection(null);
                    }}
                  >
                    섹션 없음
                  </div>
                )}
                <ul className="mt-1 space-y-0.5 border-l border-[#E5E7EB] pl-2" aria-label={`${group.section?.name ?? "섹션 없음"} 폴더`}>
                  {group.folders.map((folder) => {
                    const active = props.selection?.kind === "folder" && props.selection.id === folder.id;
                    const count = countBookmarks(props.bookmarks, { folderId: folder.id, favoriteOnly: props.favoriteOnly });
                    const insert = props.folderInsert?.id === folder.id ? props.folderInsert.edge : null;
                    const dropInto = Boolean(props.draggingBookmarkId && props.dragOverFolderId === folder.id);
                    return (
                      <li
                        key={folder.id}
                        className={cn(
                          "group/folder flex min-h-9 items-center rounded-md",
                          props.draggingFolderId === folder.id && "opacity-60",
                          insert === "before" && "shadow-[inset_0_2px_0_0_var(--color-brand)]",
                          insert === "after" && "shadow-[inset_0_-2px_0_0_var(--color-brand)]",
                          dropInto && "bg-indigo-50/70 ring-2 ring-[var(--color-brand)]/25"
                        )}
                        data-drop-edge={insert ?? undefined}
                        draggable={!props.mutationsDisabled}
                        onDragStart={(event) => {
                          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
                          props.onDragFolder(folder.id);
                        }}
                        onDragEnd={() => props.onDragFolder(null)}
                        onDragOver={(event) => {
                          const nav = event.currentTarget.closest("nav");
                          if (nav) scrollFromPointer(nav, event.clientY);
                          if (props.draggingBookmarkId) {
                            event.preventDefault();
                            event.stopPropagation();
                            if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                            props.onDragOverFolder(folder.id);
                            return;
                          }
                          if (!props.draggingFolderId) return;
                          event.preventDefault();
                          event.stopPropagation();
                          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                          const rect = event.currentTarget.getBoundingClientRect();
                          props.onDragOverFolder(folder.id, insertEdgeFromPointer(event.clientY, rect));
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (props.draggingBookmarkId) {
                            props.onDropBookmarkOnFolder(folder.id);
                            return;
                          }
                          if (props.draggingFolderId) props.onDropFolder(folder.id, event);
                        }}
                      >
                        <button
                          type="button"
                          aria-current={active ? "page" : undefined}
                          onClick={() => props.onSelectFolder(folder.id)}
                          className={cn(
                            "flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50",
                            active
                              ? "bg-white text-[var(--color-brand)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                              : "text-[var(--text-secondary)] hover:bg-white hover:text-[var(--text-heading)]"
                          )}
                        >
                          <FolderIcon
                            data-folder-color={folder.color ?? "#797979"}
                            className="h-4 w-4 shrink-0"
                            style={{ color: folder.color ?? "#797979" }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                          <span className="text-xs font-medium tabular-nums text-[var(--text-muted)]">{count}</span>
                        </button>
                        <ActionsMenu
                          label={folder.name}
                          mutationsDisabled={props.mutationsDisabled}
                          onEdit={() => props.onEditFolder(folder)}
                          onDelete={() => props.onDeleteFolder(folder)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </nav>
      <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] p-3">
        <button
          type="button"
          disabled={props.mutationsDisabled}
          onClick={props.onAddSection}
          className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-[var(--border-subtle)] bg-white px-3 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--color-brand)] disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />새 섹션
        </button>
        <button
          type="button"
          disabled={props.mutationsDisabled}
          onClick={props.onAddFolder}
          className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-[var(--border-subtle)] bg-white px-3 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--color-brand)] disabled:opacity-40"
        >
          <FolderPlus className="h-4 w-4" aria-hidden="true" />새 폴더
        </button>
      </div>
    </aside>
  );
}

function ActionsMenu({
  label,
  mutationsDisabled,
  onEdit,
  onDelete
}: {
  label: string;
  mutationsDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={mutationsDisabled}
          aria-label={`${label} 메뉴`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-white hover:text-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50 disabled:opacity-40"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          aria-label={`${label} 메뉴`}
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-[80] min-w-36 rounded-lg border border-[var(--border-subtle)] bg-white p-1 shadow-lg outline-none"
        >
          <DropdownMenu.Item onSelect={onEdit} className="flex h-9 cursor-pointer items-center gap-2 rounded px-3 text-sm font-medium outline-none hover:bg-[#F8FAFC] focus:bg-[#F8FAFC]">
            <Pencil className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />편집
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
          <DropdownMenu.Item onSelect={onDelete} className="flex h-9 cursor-pointer items-center gap-2 rounded px-3 text-sm font-medium text-destructive outline-none hover:bg-red-50 focus:bg-red-50">
            <Trash2 className="h-4 w-4" aria-hidden="true" />삭제
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
