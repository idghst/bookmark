# Bookmark

Next.js 기반 개인 북마크 관리 앱입니다.

## 기능

- 북마크 검색, 즐겨찾기, list/grid 보기
- 폴더와 섹션 관리
- 북마크와 폴더/섹션 정렬
- REST 저장 및 localStorage fallback

웹 → same-origin `/api/*` BFF → FastAPI REST → PostgreSQL `bookmark` 스키마로 연결됩니다.
DB 접속 정보는 API 서버에만 둡니다. MCP는 개발·점검용이며 앱의 DB 연결을 대신하지 않습니다.
서버 연결 실패 시 화면에 로컬 저장 상태가 표시됩니다. 로컬 변경은 자동 동기화되지 않으며,
재연결하면 서버 데이터로 교체됩니다.

## 실행

```bash
pnpm install
pnpm dev
```

북마크 화면은 http://localhost:3000 `/`에서 바로 열립니다.

## 환경 변수

`.env.example`을 `.env.local`로 복사하고 REST URL과 서버 간 공유 키를
설정합니다. 브라우저에는 두 값이 노출되지 않습니다.

## 운영 접근 제어

웹은 첫 입장부터 계정 입력 없이 열립니다. REST URL과 `BOOKMARK_API_KEY`는
서버 환경 변수로만 두고 브라우저에 노출하지 않습니다.
API 서버에는 `DATABASE_URL`과 동일한 `BOOKMARK_API_KEY`를 설정합니다.
빈 DB 또는 여러 소유자가 있는 DB는 API 서버의 `BOOKMARK_USER_ID`도 지정합니다.
기존 `BOOKMARK_GRAPHQL_URL`은 설정 호환용으로만 읽으며 요청은 REST로 전송합니다.

## 검증

```bash
pnpm verify
```

## 모바일 앱

Expo Router 워크스페이스는 `mobile/`에 있습니다.

```bash
pnpm install
pnpm mobile:start
pnpm mobile:web
```

모바일 검증 명령은 `pnpm mobile:typecheck`, `pnpm mobile:check`,
`pnpm mobile:doctor`입니다. 모바일은 설정 화면에서 사용자가 입력한 HTTPS API 주소와
API 키로 REST를 직접 호출합니다. 웹 서버의 환경 변수를 모바일 번들에 넣지 않습니다.

릴리스 명령은 `pnpm mobile:release -- help`이며, Finder에서는
`./mobile-release.command`를 사용할 수 있습니다. EAS login, 프로젝트 연결, 기기 등록,
원격 build, OTA 발행은 자동 실행되지 않고 각각 명시적인 릴리스 명령에서만 수행됩니다.
