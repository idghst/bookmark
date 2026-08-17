import type { BookmarkItem, Folder, Section } from "@/app/lib/bookmarks/types";

export const INITIAL_FOLDERS: Folder[] = [
  { id: "work", name: "작업", color: "#4f46e5", parentId: null, position: 0 },
  { id: "docs", name: "문서", color: "#2166d7", parentId: null, position: 1 },
  { id: "tools", name: "도구", color: "#16a34a", parentId: null, position: 2 },
  { id: "reference", name: "참고", color: "#797979", parentId: "docs", position: 0 }
];

export const INITIAL_SECTIONS: Section[] = [
  { id: "daily", name: "매일 확인", folderId: "work", position: 0 },
  { id: "deploy", name: "배포/운영", folderId: "work", position: 1 },
  { id: "frontend", name: "Frontend", folderId: "docs", position: 0 },
  { id: "backend", name: "Backend", folderId: "docs", position: 1 },
  { id: "infra", name: "Infrastructure", folderId: "tools", position: 0 }
];

export const INITIAL_BOOKMARKS: BookmarkItem[] = [
  {
    id: "bm-001",
    title: "IDGHST Admin",
    url: "https://github.com/idghst/idghst-admin",
    description: "관리자 화면 저장소",
    isFavorite: true,
    folderId: "work",
    sectionId: "daily",
    position: 0
  },
  {
    id: "bm-002",
    title: "Vercel Dashboard",
    url: "https://vercel.com/dashboard",
    description: "배포와 로그 확인",
    isFavorite: true,
    folderId: "work",
    sectionId: "deploy",
    position: 1
  },
  {
    id: "bm-003",
    title: "Supabase Dashboard",
    url: "https://supabase.com/dashboard",
    description: "DB, Auth, Storage 관리",
    isFavorite: false,
    folderId: "tools",
    sectionId: "infra",
    position: 2
  },
  {
    id: "bm-004",
    title: "Next.js Docs",
    url: "https://nextjs.org/docs",
    description: "App Router 문서",
    isFavorite: false,
    folderId: "docs",
    sectionId: "frontend",
    position: 3
  },
  {
    id: "bm-005",
    title: "Tailwind CSS",
    url: "https://tailwindcss.com/docs",
    description: "유틸리티 클래스 참조",
    isFavorite: false,
    folderId: "docs",
    sectionId: "frontend",
    position: 4
  },
  {
    id: "bm-006",
    title: "Lucide Icons",
    url: "https://lucide.dev/icons",
    description: "아이콘 검색",
    isFavorite: false,
    folderId: "reference",
    sectionId: null,
    position: 5
  },
  {
    id: "bm-007",
    title: "Supabase Data REST API",
    url: "https://supabase.com/docs/guides/api",
    description: "PostgREST 기반 Data API 문서",
    isFavorite: true,
    folderId: "docs",
    sectionId: "backend",
    position: 6
  }
];
