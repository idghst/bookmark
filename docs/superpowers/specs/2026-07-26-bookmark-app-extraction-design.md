# Bookmark 앱 이관 설계

## 목표

`/Users/idghst/Documents/idghst-admin`의 Next.js 웹 앱 뼈대와 디자인 체계를
`/Users/idghst/Documents/bookmark`에 재사용한다. 도메인 기능은 북마크만 남기고,
기존 self-host Supabase의 실제 북마크 데이터와 연결한다.

## 범위

### 포함

- Next.js 16 App Router, TypeScript, Tailwind CSS, shadcn/ui 설정
- 공통 레이아웃, 디자인 토큰, 브랜드 설정, toast, PWA 정적 자산
- 북마크 목록, 검색, 즐겨찾기, list/grid 보기
- 폴더와 섹션 생성·수정·삭제·정렬
- 북마크 생성·수정·삭제·정렬
- localStorage cache와 Supabase 연결 실패 시 샘플 데이터 fallback
- 북마크 API와 서버 전용 Supabase REST store
- 북마크 및 공통 셸에 필요한 테스트

### 제외

- 북마크 외 대시보드 화면과 API
- Vercel, Supabase table explorer, 암호화 도구, mock item 기능
- Expo/mobile 앱
- 기존 서비스와 무관한 문서와 테스트
- 인증, 사용자 관리, 신규 데이터 모델

## 구조

`idghst-admin` 전체를 복사한 뒤 삭제하지 않는다. 북마크 실행 경로의 의존 파일과
공통 설정만 선별하여 옮긴다.

```text
bookmark/
├── app/
│   ├── (dashboard)/
│   │   ├── bookmarks/page.tsx
│   │   ├── DashboardAccountMenu.tsx
│   │   ├── DashboardShell.tsx
│   │   └── layout.tsx
│   ├── api/[resource]/[[...path]]/route.ts
│   ├── components/
│   ├── lib/bookmarks/
│   ├── lib/config/brand.ts
│   ├── lib/supabase/server-config.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── manifest.ts
├── components/ui/
├── lib/utils.ts
├── public/
└── tests/
```

`/bookmarks`를 북마크 화면의 canonical route로 유지하고 `/`는 `/bookmarks`로
redirect한다. 기존 화면 구조와 테스트 계약을 보존하면서 앱 진입 시 바로 북마크를
보여준다.

## 데이터 흐름

1. 브라우저가 `/api/folders`, `/api/sections`, `/api/bookmarks`를 병렬 조회한다.
2. Next.js route handler가 서버 전용 환경 변수로 Supabase Data API를 호출한다.
3. 모든 요청은 `bookmark` schema profile과 `BOOKMARK_USER_ID` 소유자 조건을 사용한다.
4. 조회 성공 시 화면 상태와 localStorage cache를 갱신한다.
5. 서버 설정 또는 조회가 실패하면 cache를 우선 사용하고, cache도 없으면 샘플
   북마크를 표시한다.
6. CRUD와 정렬은 API 성공 결과를 반영하며, fallback 상태에서는 localStorage에
   저장한다.

## 환경 변수와 보안

- 기존 `idghst-admin/.env.local`의 북마크 연결에 필요한 값만
  `bookmark/.env.local`에 복사한다.
- `.env.local`은 git에 포함하지 않는다.
- `.env.example`에는 변수명과 설명만 남긴다.
- 브라우저에 secret key를 전달하지 않는다.
- Supabase URL, secret key, `BOOKMARK_USER_ID`가 없으면 서버 API는 명시적인
  오류를 반환하고 UI fallback이 동작한다.

## 브랜드와 UI

- `idghst-admin`의 색상, 간격, 반응형 레이아웃을 유지한다.
- 앱 이름과 metadata는 `Bookmark`로 바꾼다.
- 북마크 화면의 정보 구조와 상호작용은 변경하지 않는다.
- 계정 메뉴는 북마크 앱에서 유효한 항목만 남긴다.

## 오류 처리

- 잘못된 URL은 저장 전에 차단한다.
- Supabase 오류는 API status와 메시지를 유지해 UI에 표시한다.
- section 삭제 시 bookmark는 삭제하지 않고 미분류 상태로 이동한다.
- folder 삭제 시 기존 store와 DB 제약의 보존 동작을 유지한다.
- 비밀값이나 응답 payload를 로그에 추가하지 않는다.

## 검증

- 북마크 count/filter, store, 저장 피드백, navigation 테스트
- Supabase server config와 API contract 테스트
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- dev server에서 `/` redirect와 `/bookmarks` 렌더링 확인
- 연결된 Supabase에서 실제 목록 조회와 안전한 CRUD smoke test
- git status로 `.env.local`, build 산출물, source 저장소의 기존 dirty 파일이
  commit에 포함되지 않았는지 확인

## 완료 기준

- `bookmark` 저장소만 clone하여 설치·실행할 수 있다.
- 앱 진입 시 북마크 화면만 노출된다.
- 기존 self-host Supabase 북마크가 조회되고 CRUD가 동작한다.
- 북마크 외 도메인 route와 코드가 없다.
- typecheck, test, build, 브라우저 실측이 모두 통과한다.
