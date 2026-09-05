import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { BookmarkItem } from "@/app/lib/bookmarks/types";

export function BookmarkActionsMenu({
  bookmark,
  mutationsDisabled,
  onEdit,
  onDuplicate,
  onDelete
}: {
  bookmark: BookmarkItem;
  mutationsDisabled: boolean;
  onEdit: (bookmark: BookmarkItem) => void;
  onDuplicate: (bookmark: BookmarkItem) => void;
  onDelete: (bookmark: BookmarkItem) => void;
}) {
  return (
    <div
      className="-mr-1 -mt-1 shrink-0"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={mutationsDisabled}
            aria-label={`${bookmark.title} 메뉴`}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label={`${bookmark.title} 메뉴`} align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => onEdit(bookmark)}>
              <Pencil aria-hidden="true" />편집
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDuplicate(bookmark)}>
              <Copy aria-hidden="true" />복제
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => onDelete(bookmark)} variant="destructive">
              <Trash2 aria-hidden="true" />삭제
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
