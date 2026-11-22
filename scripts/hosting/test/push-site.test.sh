#!/usr/bin/env bash
# Acceptance test for scripts/hosting/push-site.sh: a site folder becomes the whole of a remote's
# gh-pages branch, one commit, and a second push replaces it. The remote is a bare repository.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
S="$(mktemp -d "${TMPDIR:-/tmp}/push-site-test.XXXXXX")"
trap 'rm -rf "$S"' EXIT
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
printf '[user]\n\tname = Test\n\temail = test@example.test\n' > "$S/gitconfig"
export GIT_CONFIG_GLOBAL="$S/gitconfig" GIT_CONFIG_SYSTEM=/dev/null
git init -q --bare "$S/remote.git"

mkdir -p "$S/site/assets" && echo one > "$S/site/index.html" && echo a > "$S/site/assets/_a.js" && echo test.example > "$S/site/CNAME"
out=$(bash "$REPO/scripts/hosting/push-site.sh" "$S/site" "$S/remote.git" 2>&1); r=$?
[ $r = 0 ] && ok "push exits 0" || fail "push exit $r: $out"
[ "$(git --git-dir="$S/remote.git" show gh-pages:index.html 2>&1)" = one ] && ok "gh-pages holds the site" || fail "index: $(git --git-dir="$S/remote.git" show gh-pages:index.html 2>&1)"
git --git-dir="$S/remote.git" cat-file -e gh-pages:.nojekyll 2> /dev/null && ok "gh-pages has .nojekyll, so files starting with _ are served" || fail "no .nojekyll"
[ "$(git --git-dir="$S/remote.git" show gh-pages:CNAME 2>&1)" = test.example ] && ok "CNAME kept" || fail "CNAME"

rm "$S/site/assets/_a.js" && echo two > "$S/site/index.html"
bash "$REPO/scripts/hosting/push-site.sh" "$S/site" "$S/remote.git" > /dev/null 2>&1
[ "$(git --git-dir="$S/remote.git" show gh-pages:index.html 2>&1)" = two ] && ok "a second push replaces the site" || fail "second push"
! git --git-dir="$S/remote.git" cat-file -e gh-pages:assets/_a.js 2> /dev/null && ok "files gone from the folder are gone from the branch" || fail "stale file kept"
[ "$(git --git-dir="$S/remote.git" rev-list --count gh-pages)" = 1 ] && ok "the branch is one commit: no history of old builds" || fail "history: $(git --git-dir="$S/remote.git" rev-list --count gh-pages)"

bash "$REPO/scripts/hosting/push-site.sh" "$S/nothing" "$S/remote.git" > /dev/null 2>&1; [ $? != 0 ] && ok "a missing folder is refused" || fail "missing folder pushed"

echo
if [ "$fails" = 0 ]; then echo "push-site.test.sh: all passed"; else echo "push-site.test.sh: $fails FAILED"; exit 1; fi
