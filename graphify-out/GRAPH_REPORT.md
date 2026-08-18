# Graph Report - bookmark  (2026-08-19)

## Corpus Check
- 88 files · ~47,137 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 635 nodes · 1080 edges · 60 communities (29 shown, 31 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3009e878`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- page.tsx
- BookmarksPage
- devDependencies
- index.tsx
- cn
- scripts
- toast.tsx
- compilerOptions
- validation.ts
- expo
- release.sh
- [[...path]]/route.ts
- components.json
- include
- dependencies
- favicon/route.ts
- expo-image
- (dashboard)/layout.tsx
- not-found.tsx
- react-native-reanimated
- scripts
- expo-device
- expo-font
- expo-glass-effect
- expo-linking
- expo-splash-screen
- expo-status-bar
- expo-system-ui
- @expo/ui
- expo-updates
- expo-web-browser
- react
- react-native-gesture-handler
- react-native-safe-area-context
- react-native-screens
- react-native-web
- react-native-worklets
- next.config.ts
- next-env.d.ts
- sw.js
- tailwind.config.ts
- File Map
- Bookmark 앱 이관 설계
- Graphify 지식 그래프
- Bookmark
- 웹 앱 구조 리팩터 설계
- Bookmark 모바일 앱
- Sidebar folder action menu QA
- AGENTS.md
- @expo/metro-runtime
- expo-router
- expo-secure-store
- expo-symbols
- mobile/AGENTS.md
- react-native

## God Nodes (most connected - your core abstractions)
1. `cn()` - 37 edges
2. `BookmarksPage()` - 30 edges
3. `expo` - 17 edges
4. `folderParentId()` - 16 edges
5. `scripts` - 16 edges
6. `compilerOptions` - 16 edges
7. `BookmarkItem` - 13 edges
8. `die()` - 13 edges
9. `Folder` - 12 edges
10. `invalid()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `ConsoleSidebar()` --calls--> `cn()`  [EXTRACTED]
  app/(dashboard)/ConsoleSidebar.tsx → lib/utils.ts
- `FolderTreeRow()` --calls--> `cn()`  [EXTRACTED]
  app/(dashboard)/ConsoleSidebar.tsx → lib/utils.ts
- `BookmarksLoading()` --calls--> `cn()`  [EXTRACTED]
  app/(dashboard)/bookmarks-ui/BookmarksLoading.tsx → lib/utils.ts
- `BookmarksPage()` --calls--> `cn()`  [EXTRACTED]
  app/(dashboard)/page.tsx → lib/utils.ts
- `proxy()` --calls--> `bookmarkClientAccess`  [EXTRACTED]
  proxy.ts → app/lib/bookmarks/client-auth.ts

## Import Cycles
- None detected.

## Communities (60 total, 31 thin omitted)

### Community 0 - "page.tsx"
Cohesion: 0.06
Nodes (58): BookmarksLoading(), DatabaseProgressStatus(), Field(), Modal(), SectionActionsMenu(), ConsoleSidebar(), ConsoleSidebarProps, FolderTree() (+50 more)

### Community 1 - "BookmarksPage"
Cohesion: 0.15
Nodes (24): BookmarksPage(), confirmDelete(), createSectionFromBookmarkDialog(), dropBookmark(), dropFolder(), dropSection(), hydrateFromFallback(), loadBookmarks() (+16 more)

### Community 2 - "devDependencies"
Cohesion: 0.08
Nodes (25): autoprefixer, jsdom, devDependencies, autoprefixer, jsdom, postcss, tailwindcss, @testing-library/jest-dom (+17 more)

### Community 3 - "index.tsx"
Cohesion: 0.11
Nodes (36): plugins, AddBookmarkScreen(), normalizeBookmarkUrl(), styles, errorMessageOf(), Filter, HomeScreen(), hostOf() (+28 more)

### Community 4 - "cn"
Cohesion: 0.11
Nodes (30): BookmarkActionsMenu(), BookmarkCard(), Favicon(), bookmarkHost(), normalizeUrl(), safeUrl(), Badge(), badgeVariants (+22 more)

### Community 5 - "scripts"
Cohesion: 0.05
Nodes (37): class-variance-authority, clsx, lucide-react, next, dependencies, class-variance-authority, clsx, lucide-react (+29 more)

### Community 6 - "toast.tsx"
Cohesion: 0.11
Nodes (24): ServiceWorkerRegistration(), clearToastHistory(), dismissToast(), emit(), emitHistory(), historyItems, historyListeners, items (+16 more)

### Community 7 - "compilerOptions"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, es2022, mobile, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, .next-verify/dev/types/**/*.ts (+22 more)

### Community 8 - "validation.ts"
Cohesion: 0.17
Nodes (23): errorMessage(), getRestConfig(), restRequest(), RestRequestOptions, BookmarkFormData, FolderFormData, PositionUpdate, SectionFormData (+15 more)

### Community 9 - "expo"
Cohesion: 0.07
Nodes (27): package, projectId, reactCompiler, typedRoutes, expo, android, experiments, extra (+19 more)

### Community 10 - "release.sh"
Cohesion: 0.25
Nodes (22): build(), die(), doctor(), print_help(), register_ios_device(), require_app_identity(), require_eas_login(), require_eas_project() (+14 more)

### Community 11 - "[[...path]]/route.ts"
Cohesion: 0.19
Nodes (14): DELETE(), GET(), jsonError(), noRoute(), PATCH(), POST(), readJson(), requireBookmarkAccess() (+6 more)

### Community 12 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 13 - "include"
Cohesion: 0.15
Nodes (12): compilerOptions, paths, strict, extends, include, **/*.ts, **/*.tsx, @/assets/* (+4 more)

### Community 14 - "dependencies"
Cohesion: 0.29
Nodes (7): expo, expo-constants, dependencies, expo, expo-constants, react-dom, react-dom

### Community 15 - "favicon/route.ts"
Cohesion: 0.53
Nodes (4): CACHE_HEADERS, faviconUrl(), GET(), parseHttpUrl()

### Community 20 - "scripts"
Cohesion: 0.09
Nodes (21): expo-doctor, devDependencies, expo-doctor, @types/react, typescript, @types/react, typescript, main (+13 more)

### Community 46 - "File Map"
Cohesion: 0.15
Nodes (12): App entry and common skeleton, Bookmark App Extraction Implementation Plan, Bookmark domain, Bookmark UI, File Map, Global Constraints, Task 1: Standalone Next.js Skeleton and Entry Route, Task 2: Bookmark Pure Domain Contracts (+4 more)

### Community 47 - "Bookmark 앱 이관 설계"
Cohesion: 0.15
Nodes (12): Bookmark 앱 이관 설계, 검증, 구조, 데이터 흐름, 목표, 범위, 브랜드와 UI, 오류 처리 (+4 more)

### Community 48 - "Graphify 지식 그래프"
Cohesion: 0.22
Nodes (8): Graphify 지식 그래프, 갱신, 그래프가 놓치는 런타임 엣지, 레이어, 산출물, 워크스페이스, 자주 쓰는 질의, 커뮤니티 해석

### Community 49 - "Bookmark"
Cohesion: 0.25
Nodes (7): Bookmark, 검증, 기능, 모바일 앱, 실행, 운영 접근 제어, 환경 변수

### Community 50 - "웹 앱 구조 리팩터 설계"
Cohesion: 0.29
Nodes (6): 검증, 계약 (변경 금지), 목표, 목표 구조, 범위, 웹 앱 구조 리팩터 설계

### Community 51 - "Bookmark 모바일 앱"
Cohesion: 0.29
Nodes (6): API 경계, Bookmark 모바일 앱, 검증, 릴리스 런처, 배포 전 남은 결정, 실행

### Community 52 - "Sidebar folder action menu QA"
Cohesion: 0.33
Nodes (5): Comparison history, Comparison target, Evidence and state, Required fidelity surfaces, Sidebar folder action menu QA

## Knowledge Gaps
- **241 isolated node(s):** `ConsoleSidebarProps`, `BookmarkDraft`, `BookmarkDialog`, `FolderDialog`, `SectionDialog` (+236 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `page.tsx`, `BookmarksPage`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `BRAND` connect `toast.tsx` to `page.tsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `BookmarksPage()` connect `BookmarksPage` to `page.tsx`, `cn`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `ConsoleSidebarProps`, `BookmarkDraft`, `BookmarkDialog` to the rest of the system?**
  _241 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05518207282913165 - nodes in this community are weakly interconnected._
- **Should `BookmarksPage` be split into smaller, more focused modules?**
  _Cohesion score 0.14942528735632185 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._