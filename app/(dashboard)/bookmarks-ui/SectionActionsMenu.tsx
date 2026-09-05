import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Folder, FolderSection } from "@/app/lib/bookmarks/types";

export function FolderActionsMenu({
  folder,
  mutationsDisabled,
  onAddBookmark,
  onEdit,
  onDelete
}: {
  folder: Folder;
  mutationsDisabled: boolean;
  onAddBookmark: (folder: Folder) => void;
  onEdit: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={mutationsDisabled}
          aria-label={`${folder.name} 폴더 그룹 메뉴`}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={`${folder.name} 폴더 그룹 메뉴`} align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onAddBookmark(folder)}>
            <Plus aria-hidden="true" />북마크 추가
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(folder)}>
            <Pencil aria-hidden="true" />편집
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onDelete(folder)} variant="destructive">
            <Trash2 aria-hidden="true" />삭제
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FolderSectionActionsMenu({
  folderSection,
  mutationsDisabled,
  onAddBookmark,
  onEdit,
  onDelete
}: {
  folderSection: FolderSection;
  mutationsDisabled: boolean;
  onAddBookmark: (folderSection: FolderSection) => void;
  onEdit: (folderSection: FolderSection) => void;
  onDelete: (folderSection: FolderSection) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={mutationsDisabled}
          aria-label={`${folderSection.name} 섹션 메뉴`}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={`${folderSection.name} 섹션 메뉴`} align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onAddBookmark(folderSection)}>
            <Plus aria-hidden="true" />북마크 추가
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(folderSection)}>
            <Pencil aria-hidden="true" />편집
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onDelete(folderSection)} variant="destructive">
            <Trash2 aria-hidden="true" />삭제
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
