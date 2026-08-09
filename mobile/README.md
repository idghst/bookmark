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

## 릴리스 런처

저장소 루트에서 실행합니다.

```bash
pnpm mobile:release -- help
pnpm mobile:release -- doctor
pnpm mobile:release -- build android preview
pnpm mobile:release -- update preview "북마크 정렬 수정"
```

Finder에서는 루트의 `mobile-release.command`를 열면 작업을 선택할 수 있습니다. 인자를
직접 전달할 수도 있습니다.

```bash
./mobile-release.command help
```

전역 EAS CLI는 쓰지 않으며, 런처가 `pnpm dlx`로 고정된 `eas-cli@21.7.0`만 실행합니다.

`mobile/eas.json`은 별도 `preview`/`production` profile을 둡니다. Preview Android는 내부
배포 APK, production Android는 Play 업로드용 AAB입니다. iOS preview 설치는 먼저
`register-ios-device`로 기기를 등록한 뒤 Ad Hoc IPA를 새로 빌드해야 합니다.

처음에는 `app.json`에서 `scheme`, `ios.bundleIdentifier`, `android.package`를 실제 소유자
값으로 확정한 후에만 `pnpm mobile:release -- setup`을 실행하세요. `setup`만 EAS 로그인,
프로젝트 연결, Build/Update 구성을 수행하며 실제 EAS project ID와 `updates.url`을 씁니다.
이 작업은 원격 상태를 바꾸므로 초기화만으로 실행하지 않습니다.

`update`는 Android와 iOS에 호환되는 JS·스타일·asset bundle을 함께 발행합니다. native
dependency, plugin, app identity, runtime/native config 변경은 OTA가 아니라 새 build/install이
필요합니다. EAS environment도 `preview`와 `production`을 분리해 구성하세요.

## API 경계

현재 웹의 `BOOKMARK_GRAPHQL_URL`과 `BOOKMARK_API_KEY`는 서버 전용입니다. 특히
`X-Bookmark-Key`를 Expo 번들 또는 `EXPO_PUBLIC_*`에 넣으면 안 됩니다. 실제 모바일 API는
공개 HTTPS origin과 인증 방식이 확정된 뒤 추가합니다. 가능한 경계는 Supabase Bearer 인증
직접 API, 별도 인증 BFF, 또는 로그인 없는 경우 명시적인 VPN·IP allowlist·방화벽입니다.

## 배포 전 결정할 값

`ios.bundleIdentifier`, `android.package`, URL scheme, EAS project ID와 OTA 설정은 아직
정하지 않았습니다. 실제 배포 소유자와 인증·배포 경로가 확정된 뒤 설정하고, 그때는 새 native
build가 필요합니다.
