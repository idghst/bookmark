# Bookmark 모바일 앱

Expo SDK 57 / Expo Router 기반 워크스페이스입니다. 라우트는 `src/app/`에만 두고,
공통 UI·테마·API 코드는 그 밖에 둡니다.

## 실행

저장소 루트에서 실행합니다.

```bash
pnpm install
pnpm mobile:start
pnpm mobile:web
```

Android 또는 iOS 시뮬레이터는 각각 `pnpm mobile:android`, `pnpm mobile:ios`를 사용합니다.

## 검증

```bash
pnpm mobile:typecheck
pnpm mobile:check
pnpm mobile:doctor
```

## API 경계

현재 웹의 `BOOKMARK_GRAPHQL_URL`과 `BOOKMARK_API_KEY`는 서버 전용입니다. 특히
`X-Bookmark-Key`를 Expo 번들 또는 `EXPO_PUBLIC_*`에 넣으면 안 됩니다. 실제 모바일 API는
공개 HTTPS origin과 인증 방식이 확정된 뒤 추가합니다. 가능한 경계는 Supabase Bearer 인증
직접 API, 별도 인증 BFF, 또는 로그인 없는 경우 명시적인 VPN·IP allowlist·방화벽입니다.

## 배포 전 결정할 값

`ios.bundleIdentifier`, `android.package`, URL scheme, EAS project ID와 OTA 설정은 아직
정하지 않았습니다. 실제 배포 소유자와 인증·배포 경로가 확정된 뒤 설정하고, 그때는 새 native
build가 필요합니다.
