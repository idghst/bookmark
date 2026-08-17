import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { Folder, Section } from "@/app/lib/bookmarks/types";

export function SectionActionsMenu({
  section,
  folder,
  label,
  mutationsDisabled,
  onAddBookmark,
  onEdit,
  onDelete
}: {
  section: Section;
  folder: Folder;
  label: string;
  mutationsDisabled: boolean;
  onAddBookmark: (section: Section, folder: Folder) => void;
  onEdit: (section: Section) => void;
  onDelete: (section: Section) => void;
}) {
  return (
    <div
      className="-mr-1 shrink-0"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onDragStart={(event) => event.stopPropagation()}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            disabled={mutationsDisabled}
            aria-label={`${label} 섹션 메뉴`}
            className="flex h-8 w-8 items-center justify-center rounded text-[var(--text-muted)] transition hover:bg-[#F8FAFC] hover:text-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            aria-label={`${label} 섹션 메뉴`}
            side="bottom"
            align="end"
            sideOffset={6}
            className="z-[80] min-w-36 rounded-lg border border-[var(--border-subtle)] bg-white p-1 shadow-lg outline-none"
          >
            <DropdownMenu.Item
              onSelect={() => onAddBookmark(section, folder)}
              className="flex h-9 cursor-pointer items-center gap-2 rounded px-3 text-sm font-medium text-[var(--text-heading)] outline-none hover:bg-[#F8FAFC] focus:bg-[#F8FAFC]"
            >
              <Plus className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
              북마크 추가
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => onEdit(section)}
              className="flex h-9 cursor-pointer items-center gap-2 rounded px-3 text-sm font-medium text-[var(--text-heading)] outline-none hover:bg-[#F8FAFC] focus:bg-[#F8FAFC]"
            >
              <Pencil className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
              편집
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
            <DropdownMenu.Item
              onSelect={() => onDelete(section)}
              className="flex h-9 cursor-pointer items-center gap-2 rounded px-3 text-sm font-medium text-destructive outline-none hover:bg-red-50 focus:bg-red-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              삭제
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
