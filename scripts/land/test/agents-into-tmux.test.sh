#!/usr/bin/env bash
# Test for scripts/land/agents-into-tmux.sh with a fake tmux: a stateful stub of the few commands used.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
S="$REPO/scripts/land/agents-into-tmux.sh"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/aitmux-test.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0; ok() { echo "ok   $1"; }; fail() { echo "FAIL $1"; fails=$((fails + 1)); }
mkdir -p "$SCRATCH/bin"
# State: $ST/session exists = session up; $ST/win.<name> holds that window's foreground command.
cat > "$SCRATCH/bin/tmux" << 'T'
#!/usr/bin/env bash
echo "$*" >> "$ST/log"
case "$1" in
  has-session) [ -e "$ST/session" ] ;;
  new-session) touch "$ST/session"; n=; while [ $# -gt 0 ]; do [ "$1" = -n ] && n=$2; shift; done; echo bash > "$ST/win.$n" ;;
  new-window) n=; while [ $# -gt 0 ]; do [ "$1" = -n ] && n=$2; shift; done; echo bash > "$ST/win.$n" ;;
  list-windows) for f in "$ST"/win.*; do [ -e "$f" ] && echo "${f##*/win.}"; done ;;
  list-panes) t=${3#*:=}; cat "$ST/win.$t" ;;
esac
T
chmod +x "$SCRATCH/bin/tmux"
export ST="$SCRATCH/st" PATH="$SCRATCH/bin:$PATH"; mkdir -p "$ST"

out=$(bash "$S" ann 2>&1); r=$?
[ $r = 0 ] && [ "$out" = agents:ann ] && ok "creates session and window, prints target" || fail "create: r=$r $out"
grep -q '^new-session' "$ST/log" && ok "session created when missing" || fail "no new-session"
out=$(bash "$S" ann 2>&1); r=$?
[ $r = 0 ] && [ "$out" = agents:ann ] && ok "idle window reused" || fail "reuse: r=$r $out"
out=$(bash "$S" bob 2>&1); [ "$out" = agents:bob ] && ok "second window in the same session" || fail "bob: $out"
echo claude > "$ST/win.ann"
out=$(bash "$S" ann 2>&1); r=$?
[ $r = 1 ] && grep -q refused <<< "$out" && ok "busy window refused with exit 1" || fail "busy: r=$r $out"
[ $fails = 0 ] && echo "ALL OK" || echo "$fails FAILED"
exit $((fails > 0))
