import { ExternalLink, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BookmarkActionsMenu } from "@/app/(dashboard)/bookmarks-ui/BookmarkActionsMenu";
import { Favicon } from "@/app/(dashboard)/bookmarks-ui/Favicon";
import type { BookmarkItem } from "@/app/lib/bookmarks/types";
import { bookmarkHost } from "@/app/lib/bookmarks/url";
import { cn } from "@/lib/utils";

export function BookmarkCard({
  bookmark,
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
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[#F8FAFC]">
            <Favicon url={bookmark.url} />
          </div>
          <div className="min-w-0 w-0 flex-1 space-y-1">
            <span className="block truncate text-base font-bold text-[var(--text-heading)]">{bookmark.title}</span>
            <p aria-label={bookmark.url} className="line-clamp-1 break-all text-xs leading-5 text-[var(--text-muted)]">
              <span aria-hidden="true">{bookmarkHost(bookmark.url)}</span>
            </p>
          </div>
          <BookmarkActionsMenu
            bookmark={bookmark}
            mutationsDisabled={mutationsDisabled}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-2 px-4 pt-1">
        {bookmark.description ? <p className="line-clamp-1 text-xs leading-5 text-[var(--text-muted)]">{bookmark.description}</p> : null}
        <div className="mt-auto flex justify-end">
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
