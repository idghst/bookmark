# Bookmark

Next.js 기반 개인 북마크 관리 앱입니다.

## 기능

- 북마크 검색, 즐겨찾기, list/grid 보기
- 폴더와 섹션 관리
- 북마크와 폴더/섹션 정렬
- GraphQL 저장 및 localStorage fallback

## 실행

```bash
pnpm install
pnpm dev
```

북마크 화면은 http://localhost:3000 `/`에서 바로 열립니다.

## 환경 변수

`.env.example`을 `.env.local`로 복사하고 GraphQL URL과 서버 간 공유 키를
설정합니다. 브라우저에는 두 값이 노출되지 않습니다.

## 운영 접근 제어

개인 데이터가 제공되는 화면과 `/api/*`는 HTTP Basic 인증으로 보호됩니다.
사용자 이름은 `bookmark`, 비밀번호는 배포 환경의 `BOOKMARK_API_KEY`입니다.
이 값은 브라우저 번들에는 포함되지 않으며, Vercel 환경 변수의 실제 값은
코드나 채팅에 복사하지 않습니다.

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
`pnpm mobile:doctor`입니다. 현재 웹의 `BOOKMARK_GRAPHQL_URL`과
`BOOKMARK_API_KEY`는 서버 전용이므로 모바일 앱에 복사하지 않습니다.
모바일 API는 공개 HTTPS origin과 인증 경계가 확정된 뒤 연결합니다.

릴리스 명령은 `pnpm mobile:release -- help`이며, Finder에서는
`./mobile-release.command`를 사용할 수 있습니다. EAS login, 프로젝트 연결, 기기 등록,
원격 build, OTA 발행은 자동 실행되지 않고 각각 명시적인 릴리스 명령에서만 수행됩니다.
