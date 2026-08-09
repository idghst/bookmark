#!/bin/zsh
set -uo pipefail

script_dir="${0:A:h}"

close_terminal_window_after_success() {
  [[ "${TERM_PROGRAM:-}" == "Apple_Terminal" ]] || return 0

  local terminal_tty
  terminal_tty="$(tty 2>/dev/null)" || return 0

  (
    sleep 0.2
    osascript - "$terminal_tty" <<'APPLESCRIPT'
on run argv
  set terminalTTY to item 1 of argv
  tell application "Terminal"
    repeat with targetWindow in windows
      repeat with targetTab in tabs of targetWindow
        if tty of targetTab is terminalTTY then
          close targetTab
          return
        end if
      end repeat
    end repeat
  end tell
end run
APPLESCRIPT
  ) >/dev/null 2>&1 &!
}

pause_after_failure() {
  [[ -t 0 ]] || return 0
  print
  read -r "?실패했습니다. 출력 확인 후 Return을 누르세요... " || true
}

choose_command() {
  local choice message
  choice="$(osascript <<'APPLESCRIPT'
set options to {"EAS 초기 설정", "Android Preview APK 빌드", "Android Production AAB 빌드", "iOS Preview IPA 빌드", "iOS Production 빌드", "Preview OTA 배포", "Production OTA 배포", "Android 재시작", "iOS 재시작", "Preview 상태", "Production 상태", "진단", "도움말"}
set picked to choose from list options with title "Bookmark 모바일 릴리스" with prompt "실행할 작업을 선택하세요."
if picked is false then return ""
return item 1 of picked
APPLESCRIPT
)" || return 10
  [[ -n "$choice" ]] || return 10

  case "$choice" in
    "EAS 초기 설정") command_args=(setup) ;;
    "Android Preview APK 빌드") command_args=(build android preview) ;;
    "Android Production AAB 빌드") command_args=(build android production) ;;
    "iOS Preview IPA 빌드") command_args=(build ios preview) ;;
    "iOS Production 빌드") command_args=(build ios production) ;;
    "Preview OTA 배포"|"Production OTA 배포")
      message="$(osascript -e 'text returned of (display dialog "OTA 메시지를 입력하세요." default answer "" buttons {"취소", "배포"} default button "배포" cancel button "취소")')" || return 10
      [[ -n "${message//[[:space:]]/}" ]] || {
        print -u2 "OTA 메시지는 비어 있을 수 없습니다."
        return 2
      }
      if [[ "$choice" == "Preview OTA 배포" ]]; then
        command_args=(update preview "$message")
      else
        command_args=(update production "$message")
      fi
      ;;
    "Android 재시작") command_args=(restart-android) ;;
    "iOS 재시작") command_args=(restart-ios) ;;
    "Preview 상태") command_args=(status preview) ;;
    "Production 상태") command_args=(status production) ;;
    "진단") command_args=(doctor) ;;
    "도움말") command_args=(help) ;;
    *) return 2 ;;
  esac
}

typeset -a command_args
command_args=("$@")

if (( $# == 0 )); then
  if [[ "$(uname -s)" == "Darwin" ]] && command -v osascript >/dev/null 2>&1; then
    choose_command
    selection_exit=$?
    case "$selection_exit" in
      0) ;;
      10) exit 0 ;;
      *)
        if [[ "${BOOKMARK_RELEASE_ROOT_LAUNCHER:-}" != "1" ]]; then
          pause_after_failure
        fi
        exit "$selection_exit"
        ;;
    esac
  else
    command_args=(help)
  fi
fi

if "$script_dir/release.sh" "${command_args[@]}"; then
  if [[ "${BOOKMARK_RELEASE_ROOT_LAUNCHER:-}" != "1" ]]; then
    close_terminal_window_after_success
  fi
  exit 0
else
  exit_code=$?
  if [[ "${BOOKMARK_RELEASE_ROOT_LAUNCHER:-}" != "1" ]]; then
    pause_after_failure
  fi
  exit "$exit_code"
fi
