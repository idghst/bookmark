# Project Agent Instructions

[work]
- 사용자 요청 범위의 수정과 검증이 끝나면, 금지 지시가 없는 한 즉시 `git-commit-push-korean` skill을 적용해 이 세션이 수정한 파일만 한글 커밋·안전 푸시한다. 대상이 혼재했거나 push 복구가 필요하면 사용자에게 보고한다.

[workspace]
- 이 저장소는 Next.js 웹 앱과 `mobile/` Expo 앱이다. 형제 저장소는 `api-bookmark`(FastAPI + GraphQL + Supabase)다.
- 웹은 브라우저에 비밀값을 노출하지 않는다. GraphQL URL과 `BOOKMARK_API_KEY`는 서버 환경 변수이며, 화면은 same-origin `/api/*` BFF만 호출한다.
- 모바일은 공개 HTTPS origin과 인증 경계가 확정되기 전에는 웹 서버 전용 키를 복사하지 않는다. 모바일 문서는 `mobile/AGENTS.md`(Expo SDK 버전)와 이 파일을 함께 본다.
- 멀티 에이전트는 저장소와 레인을 나눠 동시에 일한다. 맡은 레인 밖과 형제 저장소는 읽기만 한다.

[lanes]
한 레인에는 구현 에이전트를 하나만 둔다. 코디네이터는 디스패치 전에 허용 경로를 배타적으로 할당한다.

| 레인 | 허용 경로 | 같이 돌리면 안 되는 레인 |
| --- | --- | --- |
| `web-ui` | `app/(dashboard)/`의 화면·셸 컴포넌트. 기본은 `ConsoleSidebar.tsx`, `DashboardShell.tsx`, `layout.tsx`와 앞으로 분리되는 presentational 파일 | `page.tsx`를 수정하면 `web-state`와 동시에 돌리지 않는다. |
| `web-state` | `app/(dashboard)/page.tsx` | `web-ui`, `web-lib`의 타입/헬퍼를 이 파일이 import하면 헬퍼 시그니처를 바꾸지 않는다. |
| `web-lib` | `app/lib/bookmarks/counts.ts`, `folder-tree.ts`, `sections.ts`, `app/lib/config/`, `lib/utils.ts` | `web-bff`와 동시에 `types.ts`를 수정하지 않는다. |
| `web-bff` | `app/lib/bookmarks/store.ts`, `app/lib/bookmarks/types.ts`, `app/lib/bookmarks/client-auth.ts`, `app/api/`, `proxy.ts`, `tests/bookmark-store.test.ts`, `tests/bookmark-api-route.test.ts`, `tests/bookmark-proxy.test.ts`, `tests/favicon-route.test.ts` | `web-lib`(타입), `mobile` |
| `web-chrome` | `app/layout.tsx`, `app/globals.css`, `app/manifest.ts`, `app/not-found.tsx`, `app/components/`, `components/ui/`, `public/`, `tests/pwa.test.ts`, `tests/not-found.test.tsx`, `tests/app-entry.test.tsx` | `app-entry` 테스트는 `page.tsx`에 `export default function BookmarksPage` 문자열이 있어야 한다. |
| `mobile` | `mobile/`, `mobile-release.command` | `web-bff`. REST 필드·경로를 여기서 임의로 바꾸지 않는다. |
| `tooling` | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `README.md` | lockfile을 바꾸는 작업은 단독으로 한다. |

- 이 파일(`AGENTS.md`)은 지침 변경 요청이 있을 때만 수정한다.
- `tests/bookmark-saving-feedback.test.tsx`는 `BookmarksPage` 통합 테스트다. `web-state` 또는 `web-ui` 중 한 에이전트만 맞춘다.

[contract]
아래는 한 번에 한 에이전트만 변경한다. API 계약이 먼저 바뀌어야 하면 `api-bookmark` 작업을 끝낸 뒤 이 저장소 소비자를 순차로 맞춘다.

- 웹 BFF 경로: `/api/bookmarks`, `/api/folders`, `/api/sections`와 `reorder`·`PATCH`·`DELETE` (`destination_folder_id` 포함)
- 웹 업스트림: `BOOKMARK_GRAPHQL_URL`(또는 `BOOKMARK_API_URL` → `/graphql`) + `X-Bookmark-Key`
- 웹 오류: BFF는 `{ "detail": string }`과 StoreError HTTP 상태를 유지한다
- 필드: `isFavorite`, `folderId`, `sectionId`, `parentId` (캐시의 `parent_id` 호환은 `folder-tree.ts`에서만 정규화)
- 클라이언트 타입: `app/lib/bookmarks/types.ts`와 `mobile/src/lib/types.ts`를 동시에 고치지 않는다. 한쪽을 바꾼 뒤 다른 쪽을 맞춘다.
- 환경 변수: `.env.example`의 `BOOKMARK_GRAPHQL_URL`, `BOOKMARK_API_KEY`. 브라우저에 비밀값을 넣지 않는다.
- 루트 페이지 계약: `app/(dashboard)/page.tsx`는 `export default function BookmarksPage`를 유지한다.

[parallel]
- 서로 다른 레인의 독립 작업만 동시에 실행한다. 같은 파일을 두 에이전트가 열지 않는다.
- GraphQL/REST/필드/환경 변수 변경은 병렬 금지. `api-bookmark` → `web-bff` → `web-state`/`web-ui` → `mobile` 순서를 지킨다.
- 핫스팟(항상 단독): `app/(dashboard)/page.tsx`, `app/lib/bookmarks/store.ts`, `app/lib/bookmarks/types.ts`, `app/api/[resource]/[[...path]]/route.ts`, `mobile/src/lib/api.ts`, `mobile/src/lib/types.ts`
- 포맷/임포트 정리, lockfile 갱신, 전역 리네임은 병렬 세션에서 하지 않는다.
- 다른 에이전트 파일을 재포맷하거나 요청 밖 리팩터를 하지 않는다.

[dispatch]
코디네이터(부모 에이전트)는 서브에이전트에 세션 히스토리를 넘기지 않는다. 프롬프트에 다음을 모두 적는다.

1. 목표와 완료 조건
2. 레인 이름, 허용 경로, 금지 경로
3. 건드리면 안 되는 계약 항목
4. 검증 명령
5. 커밋 대상 파일 범위(이 저장소, 허용 경로만)
6. 보고 형식: 변경 파일, 검증 결과, 계약 영향 여부(`none` / 항목 나열)

서브에이전트는 허용 경로 밖을 수정해야 하면 중단하고 코디네이터에 막힌 경로를 보고한다. 추측으로 레인을 넓히지 않는다.

병렬 예시: `web-lib` 폴더 트리 헬퍼 테스트 + `web-chrome` PWA 문구 + `mobile` 설정 화면 카피.
순차 예시: API에 필드 추가 → `web-bff` store/types → `web-state` 화면 상태 → `mobile` 타입/API.

[verify]
맡은 레인 검증을 통과시키기 전에 완료로 보고하지 않는다.

- 웹: `pnpm typecheck` 그리고 관련 테스트(`pnpm test`). 화면·BFF를 넓게 바꿨으면 `pnpm verify`.
- 모바일: `pnpm mobile:typecheck`와 `pnpm mobile:check`. `pnpm mobile:doctor`와 릴리스 명령은 요청이 있을 때만 실행한다.
- `tests/app-entry.test.tsx`는 `page.tsx` 소스 문자열을 검사한다. 기본 export 함수 이름을 바꾸지 않는다.
- 병렬 작업이 모두 돌아온 뒤 코디네이터가 영향 범위의 검증을 한 번 더 실행한다.

[git]
- 커밋·푸시는 이 저장소에서, 이 세션이 수정한 파일만 한다. `api-bookmark` 변경을 여기 커밋에 섞지 않는다.
- 웹 레인 에이전트는 `mobile/`을, 모바일 레인 에이전트는 웹 앱 파일을 커밋에 넣지 않는다.
- 시크릿, `.env.local`, 토큰, `.next`, `node_modules`를 커밋하지 않는다.
