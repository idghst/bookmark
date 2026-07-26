# Bookmark App Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Bookmark web app in `/Users/idghst/Documents/bookmark` using the `idghst-admin` Next.js skeleton while retaining only the working bookmark domain.

**Architecture:** Selectively copy the tracked, clean Next.js configuration and UI dependencies from `/Users/idghst/Documents/idghst-admin`, then keep the bookmark page, API route, domain helpers, and Supabase REST store as the only domain path. `/` redirects to canonical `/bookmarks`; browser requests go through same-origin Next.js route handlers so Supabase secrets remain server-only, with localStorage/sample fallback preserved.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.7, Tailwind CSS 3.4, radix-ui, lucide-react, Vitest 2, Testing Library, Supabase PostgREST

## Global Constraints

- Reuse the existing `idghst-admin` colors, spacing, responsive layout, and tracked common assets.
- Retain only bookmark list/search/favorites/view modes, folder/section CRUD, bookmark CRUD, sorting, cache, API, and tests.
- Exclude all other dashboard routes, Vercel/Data/encryption features, mock items, Expo/mobile, and unrelated docs/tests.
- Do not add dependencies beyond those already present in `idghst-admin/package.json`.
- Keep `/bookmarks` canonical and redirect `/` to `/bookmarks`.
- Rename app metadata to `Bookmark`.
- Use `BOOKMARK_SUPABASE_URL`, `BOOKMARK_SUPABASE_SECRET_KEY`, optional `BOOKMARK_SUPABASE_SERVICE_ROLE_KEY`, and `BOOKMARK_USER_ID`.
- Never commit `.env.local`, secret keys, tokens, `.next`, `node_modules`, or generated build output.
- Preserve `/Users/idghst/Documents/idghst-admin` dirty files unchanged.
- Commit only task-owned files with concise Korean commit messages; push without force.

---

## File Map

### App entry and common skeleton

- Create `package.json` — standalone scripts and existing dependency set.
- Create `pnpm-lock.yaml`, `pnpm-workspace.yaml` — reproducible pnpm install and approved native build scripts.
- Create `next.config.ts`, `tsconfig.json`, `postcss.config.js`, `tailwind.config.ts`, `vitest.config.ts`, `next-env.d.ts` — source-compatible build/test configuration.
- Create `.gitignore`, `.env.example`, `components.json` — repository, environment, and shadcn contracts.
- Create `app/layout.tsx`, `app/globals.css`, `app/manifest.ts` — metadata, shared tokens, and PWA manifest.
- Create `app/(dashboard)/page.tsx` — `/` redirect.
- Create `app/(dashboard)/layout.tsx`, `app/(dashboard)/DashboardShell.tsx` — common full-height shell.
- Create `app/components/ServiceWorkerRegistration.tsx`, `app/components/toast.tsx` — PWA registration and feedback.
- Create `app/lib/config/brand.ts` — Bookmark branding.
- Create `lib/utils.ts` — `cn()` utility.
- Create `public/**` — existing favicon, icons, font, offline page, service worker.

### Bookmark domain

- Create `app/lib/bookmarks/types.ts` — bookmark/folder/section contracts.
- Create `app/lib/bookmarks/counts.ts` — filter/count pure functions.
- Create `app/lib/bookmarks/sections.ts` — normalized same-folder section lookup.
- Create `app/lib/bookmarks/store.ts` — owner-scoped Supabase REST CRUD.
- Create `app/lib/supabase/server-config.ts` — server credential/header construction.
- Create `app/api/[resource]/[[...path]]/route.ts` — bookmark/folder/section route handlers.

### Bookmark UI

- Create `app/(dashboard)/bookmarks/page.tsx` — complete bookmark interaction surface.
- Create `app/(dashboard)/DashboardAccountMenu.tsx` — bookmark-only account popup.
- Create `components/ui/badge.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx` — only UI primitives imported by bookmark page.

### Verification and documentation

- Create `tests/setup.ts`, `tests/app-entry.test.tsx`, `tests/bookmark-counts.test.ts`, `tests/bookmark-store.test.ts`, `tests/bookmark-saving-feedback.test.tsx`, `tests/bookmark-navigation.test.tsx`, `tests/pwa.test.ts`, `tests/supabase-server-config.test.ts`.
- Modify `README.md` — standalone setup, environment, routes, and verification.
- Create local-only `.env.local` — filtered production connection values; never stage.

---

### Task 1: Standalone Next.js Skeleton and Entry Route

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `pnpm-workspace.yaml`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.js`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `next-env.d.ts`
- Create: `components.json`
- Create: `lib/utils.ts`
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `app/manifest.ts`
- Create: `app/(dashboard)/page.tsx`
- Create: `app/components/ServiceWorkerRegistration.tsx`
- Create: `app/components/toast.tsx`
- Create: `app/lib/config/brand.ts`
- Create: `public/brand/favicon-16.png`
- Create: `public/brand/favicon-32.png`
- Create: `public/favicon.ico`
- Create: `public/favicon.png`
- Create: `public/favicon.svg`
- Create: `public/fonts/PretendardVariable.woff2`
- Create: `public/icons/apple-touch-icon.png`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/offline.html`
- Create: `public/sw.js`
- Create: `tests/setup.ts`
- Test: `tests/app-entry.test.tsx`
- Test: `tests/pwa.test.ts`

**Interfaces:**
- Consumes: tracked configuration and assets from `/Users/idghst/Documents/idghst-admin`.
- Produces: `BRAND`, `DEMO_USER`, `cn()`, root metadata/PWA registration, and `/` → `/bookmarks`.

- [ ] **Step 1: Copy the clean base configuration and install dependencies**

Use the source versions for all unchanged configuration, CSS, utility, toast, manifest, and public assets. Before copying each tracked source file, confirm it has no source worktree diff:

```bash
git -C /Users/idghst/Documents/idghst-admin diff --quiet -- \
  .gitignore pnpm-lock.yaml pnpm-workspace.yaml next.config.ts tsconfig.json \
  postcss.config.js tailwind.config.ts vitest.config.ts next-env.d.ts \
  components.json lib/utils.ts app/globals.css app/manifest.ts \
  app/components/toast.tsx public
```

Create `package.json` from the source package while changing only:

```json
{
  "name": "bookmark",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "verify": "pnpm typecheck && pnpm test && pnpm build"
  }
}
```

Keep the source `dependencies`, `devDependencies`, and `packageManager` objects unchanged. Run:

```bash
pnpm install --frozen-lockfile
```

Expected: exit `0` and `node_modules/next/package.json` exists.

- [ ] **Step 2: Write failing entry and PWA tests**

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `tests/app-entry.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect }));

import HomePage from "@/app/(dashboard)/page";

describe("app entry", () => {
  it("redirects the root route to bookmarks", () => {
    HomePage();
    expect(redirect).toHaveBeenCalledWith("/bookmarks");
  });
});
```

Copy `tests/pwa.test.ts` exactly from the source.

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```bash
pnpm test -- tests/app-entry.test.tsx tests/pwa.test.ts
```

Expected: FAIL because `app/(dashboard)/page.tsx` and `app/manifest.ts` are not both available yet.

- [ ] **Step 4: Implement the Bookmark entry and brand**

Create `app/(dashboard)/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/bookmarks");
}
```

Create `app/lib/config/brand.ts`:

```ts
export const BRAND = {
  appName: "Bookmark",
  productName: "",
  description: "개인 북마크를 폴더와 섹션으로 관리합니다."
} as const;

export const DEMO_USER = {
  name: "이희승",
  org: "Bookmark"
} as const;
```

Create `app/components/ServiceWorkerRegistration.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Service Worker registration failed:", error);
    });
  }, []);

  return null;
}
```

Create `app/layout.tsx` from the source and replace `TemplateActionRuntime` with:

```tsx
import { ServiceWorkerRegistration } from "@/app/components/ServiceWorkerRegistration";
```

Render `<ServiceWorkerRegistration />` before `<Toaster />`. Keep all source metadata/icon definitions.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
pnpm test -- tests/app-entry.test.tsx tests/pwa.test.ts
pnpm typecheck
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit the skeleton**

```bash
git add .gitignore package.json pnpm-lock.yaml pnpm-workspace.yaml \
  next.config.ts tsconfig.json postcss.config.js tailwind.config.ts \
  vitest.config.ts next-env.d.ts components.json lib app public tests/setup.ts \
  tests/app-entry.test.tsx tests/pwa.test.ts
git commit -m "북마크 앱 기본 뼈대 구성"
git push
```

Expected: only Task 1 files are committed.

---

### Task 2: Bookmark Pure Domain Contracts

**Files:**
- Create: `app/lib/bookmarks/types.ts`
- Create: `app/lib/bookmarks/counts.ts`
- Create: `app/lib/bookmarks/sections.ts`
- Test: `tests/bookmark-counts.test.ts`

**Interfaces:**
- Consumes: none beyond TypeScript.
- Produces: `BookmarkItem`, `Folder`, `Section`, `BookmarkFormData`, `FolderFormData`, `PositionUpdate`, `matchesBookmarkFilters()`, `countBookmarks()`, and `findSectionByName()`.

- [ ] **Step 1: Write the failing count/filter test**

Copy `tests/bookmark-counts.test.ts` exactly from the source. Add this section normalization assertion:

```ts
import { findSectionByName } from "@/app/lib/bookmarks/sections";

it("finds a section by trimmed case-insensitive name in the same folder", () => {
  const sections = [
    { id: "s1", name: "Frontend", folderId: "docs", position: 0 },
    { id: "s2", name: "Frontend", folderId: "work", position: 0 }
  ];

  expect(findSectionByName(sections, "docs", " frontend ")?.id).toBe("s1");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test -- tests/bookmark-counts.test.ts
```

Expected: FAIL because `app/lib/bookmarks/*` does not exist.

- [ ] **Step 3: Implement the pure domain modules**

Copy these files exactly from the source:

```text
/Users/idghst/Documents/idghst-admin/app/lib/bookmarks/types.ts
/Users/idghst/Documents/idghst-admin/app/lib/bookmarks/counts.ts
/Users/idghst/Documents/idghst-admin/app/lib/bookmarks/sections.ts
```

Do not add validation layers or new types.

- [ ] **Step 4: Run the focused test**

Run:

```bash
pnpm test -- tests/bookmark-counts.test.ts
pnpm typecheck
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit the domain helpers**

```bash
git add app/lib/bookmarks/types.ts app/lib/bookmarks/counts.ts \
  app/lib/bookmarks/sections.ts tests/bookmark-counts.test.ts
git commit -m "북마크 도메인 계약 이관"
git push
```

---

### Task 3: Server-Only Supabase Store and API

**Files:**
- Create: `app/lib/supabase/server-config.ts`
- Create: `app/lib/bookmarks/store.ts`
- Create: `app/api/[resource]/[[...path]]/route.ts`
- Create: `.env.example`
- Test: `tests/supabase-server-config.test.ts`
- Test: `tests/bookmark-store.test.ts`

**Interfaces:**
- Consumes: bookmark domain types and `findSectionByName()`.
- Produces: `getSupabaseServerConfig(): SupabaseServerConfig | null`, `createSupabaseRestHeaders()`, `StoreError`, `bookmarkStore`, and same-origin GET/POST/PATCH/DELETE endpoints for `bookmarks`, `folders`, and `sections`.

- [ ] **Step 1: Write failing Bookmark-specific environment tests**

Copy `tests/supabase-server-config.test.ts` and `tests/bookmark-store.test.ts` from the source. In both files replace:

```text
IDGHST_ADMIN_SUPABASE_URL -> BOOKMARK_SUPABASE_URL
IDGHST_ADMIN_SUPABASE_SECRET_KEY -> BOOKMARK_SUPABASE_SECRET_KEY
IDGHST_ADMIN_SUPABASE_SERVICE_ROLE_KEY -> BOOKMARK_SUPABASE_SERVICE_ROLE_KEY
IDGHST_ADMIN_SUPABASE_ANON_KEY -> BOOKMARK_SUPABASE_ANON_KEY
IDGHST_ADMIN_SUPABASE_PUBLISHABLE_KEY -> BOOKMARK_SUPABASE_PUBLISHABLE_KEY
```

The security assertion remains:

```ts
expect(getSupabaseServerConfig()).toBeNull();
```

when only anon/publishable keys are present.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test -- tests/supabase-server-config.test.ts tests/bookmark-store.test.ts
```

Expected: FAIL because server config and store modules are absent.

- [ ] **Step 3: Implement Bookmark server config**

Create `app/lib/supabase/server-config.ts` using the source implementation, but replace the environment resolution with:

```ts
const url = (
  process.env.BOOKMARK_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL
)?.replace(/\/$/, "");
const apiKey =
  process.env.BOOKMARK_SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  process.env.BOOKMARK_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;
```

Keep opaque `sb_secret_` keys without `Authorization`; keep legacy service-role JWTs as `Bearer`.

- [ ] **Step 4: Implement the store and route handler**

Copy these files exactly from the source:

```text
/Users/idghst/Documents/idghst-admin/app/lib/bookmarks/store.ts
/Users/idghst/Documents/idghst-admin/app/api/[resource]/[[...path]]/route.ts
```

In `store.ts`, replace the missing-config error with:

```ts
throw new StoreError(
  "BOOKMARK_SUPABASE_URL and BOOKMARK_SUPABASE_SECRET_KEY are required.",
  500
);
```

Keep `BOOKMARK_SCHEMA = "bookmark"`, table names `items`, `folders`, `sections`, and all owner filters.

- [ ] **Step 5: Add the tracked environment template**

Create `.env.example`:

```dotenv
# Server-only self-host Supabase connection
BOOKMARK_SUPABASE_URL=https://supabase.example.com
BOOKMARK_SUPABASE_SECRET_KEY=
BOOKMARK_USER_ID=
```

Do not add a real URL, key, or user ID.

- [ ] **Step 6: Run store and security tests**

Run:

```bash
pnpm test -- tests/supabase-server-config.test.ts tests/bookmark-store.test.ts
pnpm typecheck
```

Expected: both commands exit `0`; tests confirm `bookmark` profile headers and no browser-safe key fallback.

- [ ] **Step 7: Commit the server path**

```bash
git add .env.example app/lib/supabase/server-config.ts \
  app/lib/bookmarks/store.ts 'app/api/[resource]/[[...path]]/route.ts' \
  tests/supabase-server-config.test.ts tests/bookmark-store.test.ts
git commit -m "북마크 Supabase API 이관"
git push
```

---

### Task 4: Bookmark-Only UI

**Files:**
- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/DashboardShell.tsx`
- Create: `app/(dashboard)/DashboardAccountMenu.tsx`
- Create: `app/(dashboard)/bookmarks/page.tsx`
- Create: `components/ui/badge.tsx`
- Create: `components/ui/button.tsx`
- Create: `components/ui/card.tsx`
- Create: `components/ui/input.tsx`
- Create: `components/ui/select.tsx`
- Create: `components/ui/textarea.tsx`
- Test: `tests/bookmark-saving-feedback.test.tsx`
- Test: `tests/bookmark-navigation.test.tsx`

**Interfaces:**
- Consumes: `BRAND`, `DEMO_USER`, bookmark domain helpers/types, API endpoints, and `cn()`.
- Produces: responsive `/bookmarks` UI with folders, sections, CRUD dialogs, search, favorites, list/grid mode, drag sorting, cache fallback, and bookmark-only navigation.

- [ ] **Step 1: Write the failing navigation test**

Create `tests/bookmark-navigation.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardAccountMenu } from "@/app/(dashboard)/DashboardAccountMenu";

describe("bookmark navigation", () => {
  it("exposes only the bookmark route", () => {
    render(<DashboardAccountMenu />);
    fireEvent.click(screen.getByLabelText("사용자 메뉴 열기"));

    expect(screen.getByRole("menuitem", { name: "북마크" })).toHaveAttribute(
      "href",
      "/bookmarks"
    );
    expect(screen.queryByText("Vercel 배포")).not.toBeInTheDocument();
    expect(screen.queryByText("Supabase")).not.toBeInTheDocument();
    expect(screen.queryByText("도구")).not.toBeInTheDocument();
    expect(screen.queryByText("설정")).not.toBeInTheDocument();
  });
});
```

Copy `tests/bookmark-saving-feedback.test.tsx` exactly from the source.

- [ ] **Step 2: Run UI tests to verify they fail**

Run:

```bash
pnpm test -- tests/bookmark-navigation.test.tsx tests/bookmark-saving-feedback.test.tsx
```

Expected: FAIL because Bookmark UI components do not exist.

- [ ] **Step 3: Add only the imported UI primitives**

Copy exactly:

```text
components/ui/badge.tsx
components/ui/button.tsx
components/ui/card.tsx
components/ui/input.tsx
components/ui/select.tsx
components/ui/textarea.tsx
```

Do not copy `table`, `scroll-area`, or `separator` because the bookmark route does not import them.

- [ ] **Step 4: Add the dashboard layout and minimal shell**

Create `app/(dashboard)/layout.tsx`:

```tsx
import { DashboardShell } from "@/app/(dashboard)/DashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
```

Create `app/(dashboard)/DashboardShell.tsx`:

```tsx
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-dvh min-h-0 overflow-hidden bg-[#F5F6F8]">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Add the bookmark-only account menu**

Start from the source `DashboardAccountMenu.tsx`. Keep the outside-click/Escape behavior, profile button, bookmark menu item, and disabled logout. Replace `MENU` with:

```tsx
const MENU: Array<{ href: string; label: string; icon: typeof Bookmark }> = [
  { href: "/bookmarks", label: "북마크", icon: Bookmark }
];
```

Remove `Bell`, `Database`, `Rocket`, `Settings`, and `Wrench` imports and remove notification/settings links.

- [ ] **Step 6: Add the existing bookmark interaction surface**

Copy `app/(dashboard)/bookmarks/page.tsx` exactly from the source, then make only these standalone changes:

```ts
const STORAGE_KEY = "bookmark-cache";
```

Keep all sample folders/sections/bookmarks, URL validation, portal dialogs, drag rules, saving feedback, and same-origin API paths unchanged.

- [ ] **Step 7: Run UI tests and typecheck**

Run:

```bash
pnpm test -- tests/bookmark-navigation.test.tsx tests/bookmark-saving-feedback.test.tsx
pnpm typecheck
```

Expected: all tests pass and TypeScript exits `0`.

- [ ] **Step 8: Commit the Bookmark UI**

```bash
git add 'app/(dashboard)' components/ui tests/bookmark-navigation.test.tsx \
  tests/bookmark-saving-feedback.test.tsx
git commit -m "북마크 전용 화면 이관"
git push
```

---

### Task 5: Production Connection, Documentation, and End-to-End Verification

**Files:**
- Create local-only: `.env.local`
- Modify: `README.md`
- Verify: all tracked application files

**Interfaces:**
- Consumes: existing `idghst-admin/.env.local` values and all Tasks 1–4.
- Produces: cloneable documentation, live Supabase connection, full green checks, browser evidence, and reversible CRUD evidence.

- [ ] **Step 1: Create a filtered local environment file without printing secrets**

Read only these source names:

```text
IDGHST_ADMIN_SUPABASE_URL
IDGHST_ADMIN_SUPABASE_SECRET_KEY
IDGHST_ADMIN_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
BOOKMARK_USER_ID
```

Write only the first available URL, first available secret/service-role key, and `BOOKMARK_USER_ID` to `.env.local` without printing their values:

```bash
node <<'NODE'
const fs = require("node:fs");
const sourcePath = "/Users/idghst/Documents/idghst-admin/.env.local";
const values = {};

for (const line of fs.readFileSync(sourcePath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
  if (!match) continue;
  let value = match[2].trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  values[match[1]] = value;
}

const first = (...keys) => keys.map((key) => values[key]).find(Boolean);
const url = first(
  "BOOKMARK_SUPABASE_URL",
  "IDGHST_ADMIN_SUPABASE_URL",
  "SUPABASE_URL"
);
const secret = first(
  "BOOKMARK_SUPABASE_SECRET_KEY",
  "IDGHST_ADMIN_SUPABASE_SECRET_KEY",
  "IDGHST_ADMIN_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
);
const userId = first("BOOKMARK_USER_ID");

if (!url || !secret || !userId) {
  throw new Error("Source .env.local is missing a bookmark URL, server secret, or BOOKMARK_USER_ID.");
}

fs.writeFileSync(
  ".env.local",
  [
    `BOOKMARK_SUPABASE_URL=${JSON.stringify(url)}`,
    `BOOKMARK_SUPABASE_SECRET_KEY=${JSON.stringify(secret)}`,
    `BOOKMARK_USER_ID=${JSON.stringify(userId)}`,
    ""
  ].join("\n"),
  { mode: 0o600 }
);
NODE
```

Set permissions:

```bash
chmod 600 .env.local
git check-ignore .env.local
```

Expected: `.env.local` is ignored; no secret value appears in terminal output or git diff.

- [ ] **Step 2: Replace README with standalone instructions**

Document:

```markdown
# Bookmark

Next.js 기반 개인 북마크 관리 앱입니다.

## 기능

- 북마크 검색, 즐겨찾기, list/grid 보기
- 폴더와 섹션 관리
- 북마크와 폴더/섹션 정렬
- self-host Supabase 저장 및 localStorage fallback

## 실행

pnpm install
pnpm dev

앱은 http://localhost:3000 에서 `/bookmarks`로 이동합니다.

## 환경 변수

`.env.example`을 `.env.local`로 복사하고 서버 전용 값을 설정합니다.

## 검증

pnpm verify
```

- [ ] **Step 3: Run the complete automated verification**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands exit `0`.

- [ ] **Step 4: Start the app and verify HTTP/data surfaces**

Start with the repository-required fallback:

```bash
node node_modules/next/dist/bin/next dev
```

Verify:

```bash
curl -I http://localhost:3000/
curl -fsS http://localhost:3000/api/folders
curl -fsS http://localhost:3000/api/sections
curl -fsS http://localhost:3000/api/bookmarks
```

Expected:

- `/` responds with a redirect to `/bookmarks`.
- Each API returns JSON arrays.
- Bookmark rows contain `id`, `title`, `url`, `folderId`, `sectionId`, and `position`.

- [ ] **Step 5: Run a reversible live bookmark CRUD smoke test**

Use the first existing folder ID from `/api/folders`. Create a uniquely named temporary bookmark, capture its returned `id`, update its title/favorite flag, fetch the list to confirm the update, delete that exact ID, then fetch again to confirm absence:

```bash
node <<'NODE'
const baseUrl = "http://localhost:3000";
const stamp = Date.now();
let createdId = null;

async function json(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: options?.body ? { "Content-Type": "application/json" } : undefined
  });
  if (!response.ok) throw new Error(`${options?.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

try {
  const folders = await json("/api/folders");
  if (!folders[0]?.id) throw new Error("No existing folder is available for the smoke bookmark.");

  const created = await json("/api/bookmarks", {
    method: "POST",
    body: JSON.stringify({
      title: `Codex migration smoke ${stamp}`,
      url: "https://example.com/codex-bookmark-smoke",
      description: "Temporary verification row",
      isFavorite: false,
      folderId: folders[0].id,
      sectionId: null
    })
  });
  createdId = created.id;

  const updated = await json(`/api/bookmarks/${createdId}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: `Codex migration smoke updated ${stamp}`,
      isFavorite: true
    })
  });
  if (!updated.isFavorite || !updated.title.includes("updated")) {
    throw new Error("PATCH response did not contain the expected update.");
  }

  const listed = await json("/api/bookmarks");
  if (!listed.some((item) => item.id === createdId && item.isFavorite)) {
    throw new Error("Updated smoke bookmark was not returned by GET.");
  }
} finally {
  if (createdId) {
    await json(`/api/bookmarks/${createdId}`, { method: "DELETE" });
    const remaining = await json("/api/bookmarks");
    if (remaining.some((item) => item.id === createdId)) {
      throw new Error("Smoke bookmark still exists after DELETE.");
    }
  }
}
NODE
```

Expected: POST `201`, PATCH `200`, DELETE `204`, and the final GET does not contain the created ID. If any step fails, do not delete or modify unrelated rows; report the exact response.

- [ ] **Step 6: Verify the browser surface**

Open `http://localhost:3000/` in the browser. Confirm:

- redirect lands on `/bookmarks`;
- existing folders and bookmark cards render;
- search narrows results;
- favorite filter changes visible count;
- list/grid control changes layout;
- create/edit dialog opens and closes;
- mobile viewport exposes the folder drawer;
- console has no uncaught error.

- [ ] **Step 7: Audit final scope and secrets**

Run:

```bash
git status --short
git ls-files | rg '(^|/)(deployments|data|tools|encryption|mobile)(/|$)'
git grep -n 'IDGHST_ADMIN' -- ':!docs/superpowers/**'
git status --short --ignored .env.local
```

Expected:

- only `README.md` is tracked and uncommitted at this task boundary;
- no unrelated domain paths are tracked;
- no source-specific environment names remain;
- `.env.local` reports `!! .env.local` and remains ignored.

- [ ] **Step 8: Commit documentation and final verification state**

```bash
git add README.md
git commit -m "북마크 앱 실행 문서 정리"
git push
```

Final expected state:

```bash
git status --short --branch
```

prints `## main...origin/main` with no tracked or untracked application changes.
