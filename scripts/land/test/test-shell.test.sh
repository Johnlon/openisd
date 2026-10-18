#!/usr/bin/env bash
# scripts/test-shell.sh runs every scripts/**/test/*.test.sh, all of them even after a red one, and is red when any is
# (T400: release.test.sh sat red because nothing ran it). Scratch tree with real tests, no fakes of the runner.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RUNNER="$REPO/scripts/test-shell.sh"
S=$(mktemp -d); trap 'rm -rf "$S"' EXIT
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

[ -f "$RUNNER" ] || { fail "scripts/test-shell.sh exists"; echo "test-shell.test.sh: $fails FAILED"; exit 1; }

mk() { mkdir -p "$S/$1/scripts/$2/test"; printf '#!/usr/bin/env bash\n%s\n' "$4" > "$S/$1/scripts/$2/test/$3.test.sh"; }

# 1. all green: exit 0, every test named
mk green a one 'exit 0'; mk green b/c two 'exit 0'
out=$(bash "$RUNNER" "$S/green" 2>&1); rc=$?
[ "$rc" = 0 ] && ok "all green: exit 0" || fail "all green exited $rc: $out"
grep -q 'scripts/a/test/one.test.sh' <<< "$out" && grep -q 'scripts/b/c/test/two.test.sh' <<< "$out" \
  && ok "tests in nested folders are found" || fail "a nested test was not run: $out"

# 2. one red among greens: exit 1, the red named, the green after it still ran
mk red a one 'exit 0'; mk red a two 'echo boom-marker; exit 3'; mk red a three 'echo three-ran > "'"$S"'/three"; exit 0'
out=$(bash "$RUNNER" "$S/red" 2>&1); rc=$?
[ "$rc" = 1 ] && ok "one red: exit 1" || fail "one red exited $rc"
grep -q 'FAIL.*two.test.sh' <<< "$out" && grep -q 'boom-marker' <<< "$out" && ok "the red test is named and its output shown" || fail "red not reported: $out"
[ -f "$S/three" ] && ok "a test after the red one still ran" || fail "run stopped at the first red"

# 3. a hung test is killed at its deadline and counts red
mk hang a hang 'sleep 30'
out=$(SHELL_TEST_TIMEOUT_S=1 bash "$RUNNER" "$S/hang" 2>&1); rc=$?
[ "$rc" = 1 ] && grep -q 'FAIL.*hang.test.sh' <<< "$out" && ok "a hung test is red at its deadline" || fail "hang not red (rc $rc): $out"

# 4. no tests found is red (a moved folder must not read as green)
mkdir -p "$S/empty/scripts"
bash "$RUNNER" "$S/empty" > /dev/null 2>&1; [ "$?" = 1 ] && ok "no tests found: exit 1" || fail "an empty tree read as green"

echo
[ "$fails" -eq 0 ] && { echo "test-shell.test.sh: all passed"; exit 0; }
echo "test-shell.test.sh: $fails FAILED"; exit 1
