import type { DragEvent } from "react";
import { ExternalLink, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookmarkActionsMenu } from "@/app/(dashboard)/bookmarks-ui/BookmarkActionsMenu";
import { Favicon } from "@/app/(dashboard)/bookmarks-ui/Favicon";
import type { BookmarkItem } from "@/app/lib/bookmarks/types";
import { bookmarkHost } from "@/app/lib/bookmarks/url";
import { cn } from "@/lib/utils";

type InsertEdge = "before" | "after";

export function BookmarkCard({
  bookmark,
  dragging,
  dropEdge,
  canDrop,
  mutationsDisabled,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite
}: {
  bookmark: BookmarkItem;
  dragging: boolean;
  dropEdge: InsertEdge | null;
  canDrop: boolean;
  mutationsDisabled: boolean;
  onDragStart: (bookmarkId: string) => void;
  onDragEnd: () => void;
  onDragOver: (bookmarkId: string, event: DragEvent<HTMLElement>) => void;
  onDrop: (bookmarkId: string, event: DragEvent<HTMLElement>) => void;
  onEdit: (bookmark: BookmarkItem) => void;
  onDuplicate: (bookmark: BookmarkItem) => void;
  onDelete: (bookmark: BookmarkItem) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const openBookmark = () => window.open(bookmark.url, "_blank", "noopener,noreferrer");

  return (
    <Card
      className={cn(
        "group relative min-h-[120px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging ? "cursor-grabbing opacity-60" : "cursor-grab",
        dropEdge === "before" && "shadow-[inset_0_2px_0_0_hsl(var(--primary))]",
        dropEdge === "after" && "shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
      )}
      data-drop-edge={dropEdge ?? undefined}
      draggable={!mutationsDisabled}
      role="link"
      tabIndex={0}
      onClick={openBookmark}
      onDragStart={(event) => {
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        onDragStart(bookmark.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        onDragOver(bookmark.id, event);
      }}
      onDrop={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        event.stopPropagation();
        onDrop(bookmark.id, event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") openBookmark();
      }}
    >
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <Favicon url={bookmark.url} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle className="truncate">{bookmark.title}</CardTitle>
            <p aria-label={bookmark.url} className="line-clamp-1 break-all text-xs leading-5 text-muted-foreground">
              <span aria-hidden="true">{bookmarkHost(bookmark.url)}</span>
            </p>
          </div>
          <BookmarkActionsMenu
            bookmark={bookmark}
            mutationsDisabled={mutationsDisabled}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {bookmark.description ? <p className="line-clamp-1 text-xs leading-5 text-muted-foreground">{bookmark.description}</p> : null}
        <div className="mt-auto flex justify-end">
          <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              disabled={mutationsDisabled}
              aria-pressed={bookmark.isFavorite}
              onClick={() => onToggleFavorite(bookmark.id)}
            >
              <Star className={cn(bookmark.isFavorite && "fill-current")} />
              <span className="sr-only">{bookmark.title} 즐겨찾기</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={openBookmark}
            >
              <ExternalLink />
              <span className="sr-only">{bookmark.title} 열기</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
