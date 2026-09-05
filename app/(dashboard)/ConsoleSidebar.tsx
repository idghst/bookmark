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
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
        "flex w-64 max-w-[calc(100vw-1rem)] shrink-0 flex-col border-r border-border bg-background text-foreground lg:bg-muted/40",
        props.className
      )}
      aria-label="북마크 콘솔 사이드바"
    >
      <div className="flex min-h-[var(--dashboard-header-height)] shrink-0 flex-col justify-center border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            aria-label={`${BRAND.appName} 홈으로 이동`}
            className="flex min-w-0 items-center gap-2 rounded-md text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 rotate-45 text-foreground" aria-hidden="true">
              <path fill="currentColor" d="M7.15 1.2h1.7v13.6h-1.7zM1.2 7.15h13.6v1.7H1.2z" />
            </svg>
            <span className="truncate">{BRAND.appName}</span>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={props.onRefresh}
            disabled={props.refreshing}
            className="ml-auto"
            aria-label="북마크 새로고침"
          >
            <RefreshCcw className={cn("h-4 w-4", props.refreshing && "animate-spin")} aria-hidden="true" />
          </Button>
        </div>
        <span className="mt-1 text-xs text-muted-foreground">BOOKMARK CONSOLE</span>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        aria-label="북마크 폴더"
        onDragOver={(event) => {
          if (!props.draggingFolderId && !props.draggingSectionId && !props.draggingBookmarkId) return;
          scrollFromPointer(event.currentTarget, event.clientY);
        }}
      >
        <div className="flex flex-col gap-4">
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
                  group.section && props.draggingSectionId && props.dragOverSectionId === group.section.id && props.sectionInsertEdge === "before" && "shadow-[inset_0_2px_0_0_hsl(var(--primary))]",
                  group.section && props.draggingSectionId && props.dragOverSectionId === group.section.id && props.sectionInsertEdge === "after" && "shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
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
                      props.draggingFolderId && props.dragOverSectionId === group.section.id && "bg-muted ring-2 ring-ring/25"
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
                    <Button
                      variant={sectionActive ? "secondary" : "ghost"}
                      size="sm"
                      type="button"
                      aria-current={sectionActive ? "page" : undefined}
                      onClick={() => props.onSelectSection(group.section?.id ?? "")}
                      className="min-w-0 flex-1 justify-start"
                    >
                      <span
                        className="h-3 w-1 rounded-full"
                        style={{ backgroundColor: group.section.color ?? "#797979" }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{group.section.name}</span>
                    </Button>
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
                      "flex min-h-9 items-center rounded-md px-2 text-xs font-medium text-muted-foreground",
                      props.draggingFolderId && props.dragOverSectionId === "__none__" && "bg-muted ring-2 ring-ring/25"
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
                <ul className="mt-1 flex flex-col gap-0.5 pl-2" aria-label={`${group.section?.name ?? "섹션 없음"} 폴더`}>
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
                          insert === "before" && "shadow-[inset_0_2px_0_0_hsl(var(--primary))]",
                          insert === "after" && "shadow-[inset_0_-2px_0_0_hsl(var(--primary))]",
                          dropInto && "bg-muted ring-2 ring-ring/25"
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
                        <Button
                          variant={active ? "secondary" : "ghost"}
                          size="sm"
                          type="button"
                          aria-current={active ? "page" : undefined}
                          onClick={() => props.onSelectFolder(folder.id)}
                          className="min-w-0 flex-1 justify-start"
                        >
                          <FolderIcon
                            data-folder-color={folder.color ?? "#797979"}
                            data-icon="inline-start"
                            style={{ color: folder.color ?? "#797979" }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-left">{folder.name}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                        </Button>
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
      <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <Button
          variant="outline"
          type="button"
          disabled={props.mutationsDisabled}
          onClick={props.onAddSection}
        >
          <Plus data-icon="inline-start" aria-hidden="true" />새 섹션
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={props.mutationsDisabled}
          onClick={props.onAddFolder}
        >
          <FolderPlus data-icon="inline-start" aria-hidden="true" />새 폴더
        </Button>
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={mutationsDisabled}
          aria-label={`${label} 메뉴`}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={`${label} 메뉴`} align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil aria-hidden="true" />편집
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onDelete} variant="destructive">
            <Trash2 aria-hidden="true" />삭제
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
