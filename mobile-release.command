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

if BOOKMARK_RELEASE_ROOT_LAUNCHER=1 "$script_dir/mobile/script/release.command" "$@"; then
  close_terminal_window_after_success
  exit 0
else
  exit_code=$?
  pause_after_failure
  exit "$exit_code"
fi
