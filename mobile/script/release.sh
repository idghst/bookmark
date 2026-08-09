#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
mobile_dir="$(cd -- "$script_dir/.." && pwd -P)"
root_dir="$(cd -- "$mobile_dir/.." && pwd -P)"
expected_pnpm_version="11.1.0"
expected_eas_version="21.7.0"

cd "$root_dir"

die() {
  printf '오류: %s\n' "$*" >&2
  exit 1
}

print_help() {
  cat <<'EOF'
Bookmark 모바일 릴리스 명령

  setup
      EAS 로그인, 프로젝트 연결, Build/Update 구성을 진행합니다.
      app.json의 scheme, ios.bundleIdentifier, android.package를 먼저 확정해야 합니다.

  register-ios-device
      iOS Preview/Ad Hoc 설치용 기기를 EAS에 등록합니다.

  build <android|ios|all> [preview|production]
      preview Android는 내부 배포 APK, production Android는 Play 업로드용 AAB를 만듭니다.
      iOS preview는 등록된 기기와 Ad Hoc provisioning이 필요합니다.

  update <preview|production> <message>
      Android+iOS에 같은 OTA 업데이트를 발행합니다. 메시지는 필수입니다.
      native dependency, plugin, app identity, runtime/config 변경은 새 build/install이 필요합니다.

  status [preview|production]
      최근 EAS Build, channel, update branch 상태를 보여 줍니다. 기본값은 preview입니다.

  restart-android [serial]
      연결된 Android 기기에서 앱을 다시 시작합니다.

  restart-ios
      부팅된 iOS Simulator에서 앱을 다시 시작합니다.

  doctor
      TypeScript, Expo dependency, Expo Doctor를 검사합니다.

  help
      이 도움말을 표시합니다.

Examples:
  pnpm mobile:release -- help
  pnpm mobile:release -- build android preview
  pnpm mobile:release -- update preview "북마크 정렬 수정"
EOF
}

require_pnpm() {
  command -v pnpm >/dev/null 2>&1 || die "pnpm ${expected_pnpm_version}이 필요합니다."

  local installed_version
  installed_version="$(pnpm --version)"
  [[ "$installed_version" == "$expected_pnpm_version" ]] || die "pnpm ${expected_pnpm_version}이 필요합니다 (현재 ${installed_version})."
}

run_mobile() {
  (
    cd "$mobile_dir"
    pnpm exec "$@"
  )
}

run_eas() {
  (
    cd "$mobile_dir"
    pnpm dlx --package "eas-cli@${expected_eas_version}" eas "$@"
  )
}

require_eas_login() {
  local whoami_output

  if whoami_output="$(CI=1 run_eas whoami 2>&1)"; then
    return 0
  fi

  [[ -n "$whoami_output" ]] && printf '%s\n' "$whoami_output" >&2
  die "EAS 로그인 세션이 없습니다. setup을 실행해 로그인하세요."
}

run_expo() {
  run_mobile expo "$@"
}

app_value() {
  node - "$mobile_dir/app.json" "$1" <<'NODE'
const fs = require("fs");

const [file, path] = process.argv.slice(2);
let value;

try {
  value = JSON.parse(fs.readFileSync(file, "utf8")).expo;
} catch (error) {
  console.error(`Cannot read ${file}: ${error.message}`);
  process.exit(1);
}

for (const segment of path.split(".")) {
  if (!value || typeof value !== "object") break;
  value = value[segment];
}

if (typeof value === "string") {
  process.stdout.write(value);
} else if (value && typeof value === "object") {
  process.stdout.write(JSON.stringify(value));
}
NODE
}

validate_profile() {
  case "$1" in
    preview|production) ;;
    *) die "profile은 preview 또는 production이어야 합니다." ;;
  esac
}

validate_platform() {
  case "$1" in
    android|ios|all) ;;
    *) die "platform은 android, ios, all 중 하나여야 합니다." ;;
  esac
}

require_eas_project() {
  local project_id
  project_id="$(app_value "extra.eas.projectId")"
  [[ -n "$project_id" ]] || die "EAS project ID가 없습니다. app.json 식별자를 확정한 뒤 setup을 먼저 실행하세요."
}

require_app_identity() {
  local platform="$1"
  local scheme ios_bundle_id android_package
  local -a missing=()

  scheme="$(app_value "scheme")"
  ios_bundle_id="$(app_value "ios.bundleIdentifier")"
  android_package="$(app_value "android.package")"

  [[ -n "$scheme" ]] || missing+=("scheme")

  case "$platform" in
    android)
      [[ -n "$android_package" ]] || missing+=("android.package")
      ;;
    ios)
      [[ -n "$ios_bundle_id" ]] || missing+=("ios.bundleIdentifier")
      ;;
    all)
      [[ -n "$ios_bundle_id" ]] || missing+=("ios.bundleIdentifier")
      [[ -n "$android_package" ]] || missing+=("android.package")
      ;;
  esac

  if (( ${#missing[@]} > 0 )); then
    die "필수 앱 식별자가 없습니다: ${missing[*]}. 임의 값을 만들지 말고 app.json에서 확정한 뒤 setup을 실행하세요."
  fi
}

require_eas_ready() {
  require_app_identity "$1"
  require_eas_project
}

require_update_config() {
  local updates_url runtime_version
  require_eas_ready all
  updates_url="$(app_value "updates.url")"
  runtime_version="$(app_value "runtimeVersion")"
  [[ -n "$updates_url" ]] || die "updates.url이 없습니다. setup으로 EAS Update를 구성하세요."
  [[ -n "$runtime_version" ]] || die "runtimeVersion이 없습니다. setup으로 EAS Update를 구성하세요."
}

setup() {
  require_app_identity all
  printf '%s\n' 'EAS setup을 시작합니다. 로그인, 프로젝트 연결, Build/Update 구성과 app config 변경이 발생할 수 있습니다.'
  run_expo install expo-updates
  run_eas login
  run_eas init
  run_eas build:configure --platform all
  run_eas update:configure --platform all
}

register_ios_device() {
  require_eas_ready ios
  require_eas_login
  run_eas device:create
}

build() {
  local platform="${1:-}"
  local profile="${2:-preview}"

  [[ -n "$platform" ]] || die "build에는 platform이 필요합니다."
  validate_platform "$platform"
  validate_profile "$profile"
  require_eas_ready "$platform"
  require_eas_login

  if [[ "$platform" == "ios" || "$platform" == "all" ]] && [[ "$profile" == "preview" ]]; then
    printf '%s\n' 'iOS preview는 등록된 기기와 Ad Hoc provisioning이 필요합니다. 먼저 register-ios-device를 실행하세요.'
  fi

  run_eas build --platform "$platform" --profile "$profile"
}

update() {
  (( $# >= 2 )) || die "update에는 profile과 메시지가 필요합니다."

  local profile="$1"
  shift
  local message="$*"

  validate_profile "$profile"
  [[ -n "${message//[[:space:]]/}" ]] || die "OTA 메시지는 비어 있을 수 없습니다."
  require_update_config
  require_eas_login

  run_eas update --channel "$profile" --message "$message" --environment "$profile" --platform all
}

status() {
  local profile="${1:-preview}" channel_output update_output
  local channel_exit update_exit
  validate_profile "$profile"
  require_eas_project
  require_eas_login
  run_eas build:list --platform all --build-profile "$profile" --limit 10

  if channel_output="$(run_eas channel:view "$profile" 2>&1)"; then
    printf '%s\n' "$channel_output"
  else
    channel_exit=$?
    if printf '%s' "$channel_output" | grep -qiE 'not found|does not exist|no channel'; then
      printf 'EAS channel "%s"은 아직 없습니다. 첫 OTA update가 channel과 branch를 만듭니다.\n' "$profile"
      return 0
    fi
    printf '%s\n' "$channel_output" >&2
    return "$channel_exit"
  fi

  if update_output="$(run_eas update:list --branch "$profile" --platform all --limit 10 2>&1)"; then
    printf '%s\n' "$update_output"
  else
    update_exit=$?
    if printf '%s' "$update_output" | grep -qiE 'not found|does not exist|no updates'; then
      printf 'EAS branch "%s"에는 아직 OTA update가 없습니다.\n' "$profile"
      return 0
    fi
    printf '%s\n' "$update_output" >&2
    return "$update_exit"
  fi
}

restart_android() {
  local serial="${1:-}"
  local android_package
  local -a adb_args=()

  command -v adb >/dev/null 2>&1 || die "adb가 필요합니다. Android platform-tools를 설치하고 PATH에 추가하세요."
  android_package="$(app_value "android.package")"
  [[ -n "$android_package" ]] || die "android.package가 없습니다. app.json에서 확정하세요."

  [[ -n "$serial" ]] && adb_args=("-s" "$serial")
  adb "${adb_args[@]}" wait-for-device
  adb "${adb_args[@]}" shell am force-stop "$android_package"
  adb "${adb_args[@]}" shell monkey -p "$android_package" -c android.intent.category.LAUNCHER 1
}

restart_ios() {
  local ios_bundle_id

  command -v xcrun >/dev/null 2>&1 || die "xcrun이 필요합니다. Xcode를 설치하세요."
  ios_bundle_id="$(app_value "ios.bundleIdentifier")"
  [[ -n "$ios_bundle_id" ]] || die "ios.bundleIdentifier가 없습니다. app.json에서 확정하세요."
  xcrun simctl list devices booted | grep -q 'Booted' || die "부팅된 iOS Simulator가 없습니다."

  xcrun simctl terminate booted "$ios_bundle_id" || true
  xcrun simctl launch booted "$ios_bundle_id"
}

doctor() {
  (
    cd "$mobile_dir"
    pnpm run typecheck
  )
  run_expo install --check
  run_mobile expo-doctor
}

if [[ "${1:-}" == "--" ]]; then
  shift
fi

command="${1:-help}"
case "$command" in
  help|-h|--help)
    print_help
    exit 0
    ;;
esac

require_pnpm
shift

case "$command" in
  setup)
    (( $# == 0 )) || die "setup은 추가 인자를 받지 않습니다."
    setup
    ;;
  register-ios-device)
    (( $# == 0 )) || die "register-ios-device는 추가 인자를 받지 않습니다."
    register_ios_device
    ;;
  build)
    (( $# >= 1 && $# <= 2 )) || die "사용법: build <android|ios|all> [preview|production]"
    build "$@"
    ;;
  update)
    update "$@"
    ;;
  status)
    (( $# <= 1 )) || die "사용법: status [preview|production]"
    status "$@"
    ;;
  restart-android)
    (( $# <= 1 )) || die "사용법: restart-android [serial]"
    restart_android "$@"
    ;;
  restart-ios)
    (( $# == 0 )) || die "restart-ios는 추가 인자를 받지 않습니다."
    restart_ios
    ;;
  doctor)
    (( $# == 0 )) || die "doctor는 추가 인자를 받지 않습니다."
    doctor
    ;;
  *)
    die "알 수 없는 명령입니다: $command. help를 실행하세요."
    ;;
esac
