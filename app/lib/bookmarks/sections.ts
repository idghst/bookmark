import type { Section } from "@/app/lib/bookmarks/types";

export function findSectionByName(sections: Section[], name: string) {
  const normalizedName = name.trim().toLocaleLowerCase();
  return sections.find((section) => section.name.trim().toLocaleLowerCase() === normalizedName);
}
