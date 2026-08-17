# 웹 앱 구조 리팩터 설계

## 목표

`app/(dashboard)/page.tsx`(약 2150줄)를 순수 함수·상태 훅·표시 컴포넌트로 나누고, BFF `store.ts`는 검증/전송/스토어로 분리한다. 브라우저 계약과 테스트는 유지한다.

## 범위

포함: `app/lib/bookmarks/` 헬퍼, `useBookmarksPage`, 대시보드 UI 컴포넌트, store 모듈 분리.

제외: 모바일 앱 기능 변경, GraphQL/REST 계약 변경, `export default function BookmarksPage` 제거.

## 목표 구조

```text
app/lib/bookmarks/constants.ts
app/lib/bookmarks/sample-data.ts
app/lib/bookmarks/positions.ts
app/lib/bookmarks/url.ts
app/lib/bookmarks/cache.ts
app/lib/bookmarks/groups.ts
app/lib/bookmarks/client-api.ts
app/lib/bookmarks/validation.ts
app/lib/bookmarks/graphql.ts
app/lib/bookmarks/store.ts          # bookmarkStore facade
app/(dashboard)/use-bookmarks-page.ts
app/(dashboard)/bookmarks-ui/       # card, dialogs, header, loading
app/(dashboard)/page.tsx            # BookmarksPage shell
```

## 계약 (변경 금지)

- `page.tsx`에 `export default function BookmarksPage` 문자열 유지
- `tests/bookmark-saving-feedback.test.tsx`가 import하는 default export
- BFF 경로, `{ detail }`, `destination_folder_id`, GraphQL 헤더

## 검증

`pnpm typecheck`, `pnpm test`, 넓은 변경 시 `pnpm verify`
