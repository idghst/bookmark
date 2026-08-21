import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";

export const INITIAL_FOLDERS: Folder[] = [
  { id: "work", name: "작업", color: "#4f46e5", sectionId: "business", position: 0 },
  { id: "operations", name: "운영", color: "#d97706", sectionId: "business", position: 1 },
  { id: "docs", name: "문서", color: "#2166d7", sectionId: "knowledge", position: 0 },
  { id: "tools", name: "도구", color: "#16a34a", sectionId: "knowledge", position: 1 },
  { id: "reference", name: "참고", color: "#797979", sectionId: null, position: 0 }
];

export const INITIAL_SECTIONS: Section[] = [
  { id: "business", name: "업무", color: "#4f46e5", position: 0 },
  { id: "knowledge", name: "지식", color: "#2166d7", position: 1 }
];

export const INITIAL_BOOKMARKS: BookmarkItem[] = [
  {
    id: "bm-001",
    title: "IDGHST Admin",
    url: "https://github.com/idghst/idghst-admin",
    description: "관리자 화면 저장소",
    isFavorite: true,
    folderId: "work",
    position: 0
  },
  {
    id: "bm-002",
    title: "Vercel Dashboard",
    url: "https://vercel.com/dashboard",
    description: "배포와 로그 확인",
    isFavorite: true,
    folderId: "operations",
    position: 0
  },
  {
    id: "bm-003",
    title: "Supabase Dashboard",
    url: "https://supabase.com/dashboard",
    description: "DB, Auth, Storage 관리",
    isFavorite: false,
    folderId: "tools",
    position: 0
  },
  {
    id: "bm-004",
    title: "Next.js Docs",
    url: "https://nextjs.org/docs",
    description: "App Router 문서",
    isFavorite: false,
    folderId: "docs",
    position: 0
  },
  {
    id: "bm-005",
    title: "Tailwind CSS",
    url: "https://tailwindcss.com/docs",
    description: "유틸리티 클래스 참조",
    isFavorite: false,
    folderId: "docs",
    position: 1
  },
  {
    id: "bm-006",
    title: "Lucide Icons",
    url: "https://lucide.dev/icons",
    description: "아이콘 검색",
    isFavorite: false,
    folderId: "reference",
    position: 0
  },
  {
    id: "bm-007",
    title: "Supabase Data REST API",
    url: "https://supabase.com/docs/guides/api",
    description: "PostgREST 기반 Data API 문서",
    isFavorite: true,
    folderId: "docs",
    position: 2
  }
];
