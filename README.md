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

## 검증

```bash
pnpm verify
```
