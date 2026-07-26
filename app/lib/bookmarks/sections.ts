import type { Section } from "@/app/lib/bookmarks/types";

export function findSectionByName(sections: Section[], folderId: string, name: string) {
  const normalizedName = name.trim().toLocaleLowerCase();
  return sections.find(
    (section) => section.folderId === folderId && section.name.trim().toLocaleLowerCase() === normalizedName
  );
}
