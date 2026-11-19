#!/usr/bin/env bash
# T889: claiming a task leaves a clean `git status` once the claim's own edit (status: claimed) is committed.
# claim.sh writes `.task` at the clone root; it was not in .gitignore, so ship.sh refused T886 for an untracked `.task`
# (lead finding, 18 Nov 2026). Runs the real claim.sh in a scratch repo that carries THIS repo's .gitignore.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/claim-clean-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/claim-clean-status.XXXXXX")"
trap 'rm -rf "$SCRATCH" "$GITCFG" "$GITCFG.out"' EXIT
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

cd "$SCRATCH" || exit 2
git init -q -b main
mkdir -p scripts tasks src
cp -r "$REPO/scripts/land" scripts/
cp "$REPO/.gitignore" .gitignore
echo 1 > src/x.ts
printf 'id: T1\nowner: t\nstatus: open\ngoal: g\ndone_test: true\nlocked: []\nfiles:\n  - src/**\n' > tasks/T1.yml
git add -A; git commit -qm base

timeout 60 bash scripts/land/task-gates/claim.sh T1 > "$GITCFG.out" 2>&1; r=$?
[ "$r" = 0 ] && [ "$(cat .task 2>/dev/null)" = T1 ] && ok "claim wrote .task" || fail "claim (r=$r): $(cat "$GITCFG.out")"

git add tasks/T1.yml; git commit -qm "claim T1"
dirty="$(git status --porcelain)"
[ -z "$dirty" ] && ok "a claimed worktree has a clean git status" || fail "git status is not clean: $dirty"
git check-ignore -q .task && ok ".task is git-ignored" || fail ".task is not git-ignored"

[ "$fails" = 0 ] && echo "claim-clean-status: all ok" || { echo "claim-clean-status: $fails failed"; exit 1; }
