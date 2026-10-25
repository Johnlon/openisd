#!/usr/bin/env bash
# Every shell test under scripts/**/test/*.test.sh, one after another. All of them run even after a red one;
# the run is red when any is red, and when none is found. Each test has its own deadline.
#
#   bash scripts/test-shell.sh [root]      root: the repo to test (default: this repo)
#
# Gates: .github/workflows/suite.yml (job shell, the landing's candidate run) and scripts/land/post-land/suite.sh.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEADLINE_S="${SHELL_TEST_TIMEOUT_S:-600}"
cd "$ROOT" || exit 1
mapfile -t tests < <(find scripts -path '*/test/*.test.sh' | sort)
[ "${#tests[@]}" -gt 0 ] || { echo "test-shell: no scripts/**/test/*.test.sh under $ROOT; red"; exit 1; }
red=()
for t in "${tests[@]}"; do
  start=$(date +%s); log=$(mktemp)
  timeout -k 2 "$DEADLINE_S" bash "$t" > "$log" 2>&1; rc=$?
  secs=$(( $(date +%s) - start ))
  if [ "$rc" = 0 ]; then
    echo "ok   $t (${secs}s)"
  else
    echo "FAIL $t (exit $rc, ${secs}s)"; tail -n 25 "$log" | sed 's/^/  | /'
    red+=("$t")
  fi
  rm -f "$log"
done
echo "test-shell: ${#tests[@]} tests, ${#red[@]} red"
[ "${#red[@]}" -eq 0 ] || { printf 'test-shell: red: %s\n' "${red[@]}"; exit 1; }
