# Graph Report - bookmark  (2026-08-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 566 nodes · 1028 edges · 46 communities (22 shown, 24 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f92305de`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40

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
- `proxy()` --calls--> `BookmarkClientAccess`  [EXTRACTED]
  proxy.ts → app/lib/bookmarks/client-auth.ts
- `BookmarksLoading()` --calls--> `cn()`  [EXTRACTED]
  app/(dashboard)/bookmarks-ui/BookmarksLoading.tsx → lib/utils.ts
- `FolderTreeRow()` --calls--> `cn()`  [EXTRACTED]
  app/(dashboard)/ConsoleSidebar.tsx → lib/utils.ts
- `BookmarksPage()` --calls--> `cn()`  [EXTRACTED]
  app/(dashboard)/page.tsx → lib/utils.ts
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  components/ui/card.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (46 total, 24 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (45): BookmarksLoading(), DatabaseProgressStatus(), Field(), Modal(), SectionActionsMenu(), FolderTreeRow(), BookmarkDialog, BookmarkDraft (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (34): FolderTree(), handleTreeKeyDown(), toggleFolder(), BookmarksPage(), confirmDelete(), createSectionFromBookmarkDialog(), dropBookmark(), dropFolder() (+26 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (44): autoprefixer, expo-doctor, jsdom, devDependencies, expo-doctor, @types/react, typescript, main (+36 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (34): expo-router, expo-router, AddBookmarkScreen(), normalizeBookmarkUrl(), styles, errorMessageOf(), Filter, HomeScreen() (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (30): BookmarkActionsMenu(), BookmarkCard(), Favicon(), bookmarkHost(), normalizeUrl(), safeUrl(), Badge(), badgeVariants (+22 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (38): class-variance-authority, clsx, lucide-react, react-dom, next, dependencies, class-variance-authority, clsx (+30 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (27): ServiceWorkerRegistration(), clearToastHistory(), dismissToast(), emit(), emitHistory(), historyItems, historyListeners, items (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, es2022, mobile, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, .next-verify/dev/types/**/*.ts (+22 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (26): BOOKMARK_SELECTION, FOLDER_SELECTION, getGraphqlConfig(), GRAPHQL_ERROR_STATUS, GraphqlPayload, graphqlRequest(), SECTION_SELECTION, BookmarkFormData (+18 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (27): package, projectId, reactCompiler, typedRoutes, expo, android, experiments, extra (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (22): build(), die(), doctor(), print_help(), register_ios_device(), require_app_identity(), require_eas_login(), require_eas_project() (+14 more)

### Community 11 - "Community 11"
Cohesion: 0.19
Nodes (14): DELETE(), GET(), jsonError(), noRoute(), PATCH(), POST(), readJson(), requireBookmarkAccess() (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (12): compilerOptions, paths, strict, extends, include, **/*.ts, **/*.tsx, @/assets/* (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (9): expo, @expo/metro-runtime, expo-symbols, dependencies, expo, @expo/metro-runtime, expo-symbols, react-native (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.53
Nodes (4): CACHE_HEADERS, faviconUrl(), GET(), parseHttpUrl()

### Community 16 - "Community 16"
Cohesion: 0.40
Nodes (5): expo-image, expo-secure-store, plugins, expo-image, expo-secure-store

## Knowledge Gaps
- **183 isolated node(s):** `BookmarkDialog`, `BookmarkDraft`, `DeleteTarget`, `FolderDialog`, `SectionDialog` (+178 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 14` to `Community 2`, `Community 3`, `Community 5`, `Community 16`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `expo-router` connect `Community 3` to `Community 16`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `BookmarkDialog`, `BookmarkDraft`, `DeleteTarget` to the rest of the system?**
  _183 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06672519754170325 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10452961672473868 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11205073995771671 - nodes in this community are weakly interconnected._