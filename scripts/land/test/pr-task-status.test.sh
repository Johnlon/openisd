#!/usr/bin/env bash
# T891: a pull request that changes only a task file is checked for the task-file rules of task-status.test.sh.
# Main went red (suite run 44276673202, 18 Nov 2026) on tasks/T886.yml's release_note with no full stop: the check ran only
# in pr.yml's `shell` job, which runs only when scripts/ or workflows change. Two proofs:
#  1. pr.yml's `task` job (always runs) has a step that runs task-status.test.sh, and `shell`'s path filter still does not
#     match a task-file-only change (so the step in `task` is the only thing covering it).
#  2. In a scratch repo, a change of only a task file with a bad release_note makes that script fail; a good one passes.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
GITCFG="$(mktemp "${TMPDIR:-/tmp}/prts-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/prts.XXXXXX")"
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

# 1. the workflow
if python3 - "$REPO/.github/workflows/pr.yml" <<'PY'
import sys, yaml
w = yaml.safe_load(open(sys.argv[1]))
task = w["jobs"]["task"]
assert "if" not in task, "task job is conditional"
assert any("task-status.test.sh" in s.get("run", "") and "if" not in s for s in task["steps"]), "no unconditional task-status step"
assert "task" in w["jobs"]["pr-gate"]["needs"]
PY
then ok "pr.yml's task job runs task-status.test.sh unconditionally and pr-gate needs it"; else bad "pr.yml's task job does not run task-status.test.sh unconditionally"; fi
filter="$(grep -o "grep -q -e '^scripts/'[^;]*" "$REPO/.github/workflows/pr.yml" | head -1 | sed 's/ <<< .*//')"
if [ -n "$filter" ] && ! printf 'tasks/T900.yml\n' | eval "$filter"; then ok "the shell job's path filter does not match a task-file-only change"; else bad "the shell job's filter changed or matches tasks/ (this test must be revisited)"; fi

# 2. the script on a task-file-only change
cd "$SCRATCH" && git init -q r && cd r || exit 2
mkdir -p scripts/land/test tasks
cp "$REPO/scripts/land/test/task-status.test.sh" scripts/land/test/
printf 'id: T900\nrelease_note: internal\nstatus: open\n' > tasks/T900.yml
git add -A; git commit -qm base
git branch -q origin/main 2>/dev/null || git update-ref refs/remotes/origin/main HEAD
printf 'id: T901\nrelease_note: Users see a better chart\nstatus: open\n' > tasks/T901.yml
git add -A; git commit -qm "only a task file, release_note without a full stop"
if [ "$(git diff --name-only origin/main HEAD)" = tasks/T901.yml ]; then ok "fixture changes only a task file"; else bad "fixture changes more than a task file"; fi
out="$(bash scripts/land/test/task-status.test.sh 2>&1)"; rc=$?
if [ "$rc" != 0 ] && grep -q 'tasks/T901.yml: release_note is not a sentence' <<< "$out"; then ok "bad release_note in a task-file-only change is refused"; else bad "bad release_note passed (rc $rc): $out"; fi
printf 'id: T901\nrelease_note: Users see a better chart.\nstatus: open\n' > tasks/T901.yml; git commit -qam fix
out="$(bash scripts/land/test/task-status.test.sh 2>&1)"; rc=$?
if [ "$rc" = 0 ]; then ok "good release_note passes"; else bad "good release_note refused: $out"; fi

[ "$fails" = 0 ] || { echo "$fails failed"; exit 1; }
