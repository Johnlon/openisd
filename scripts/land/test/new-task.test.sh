#!/usr/bin/env bash
# T083: new-task.sh hands out ids atomically: it skips ids taken by a branch, a directory or a task
# file, claims the next with mkdir + git branch, adds the worktree, commits the task file, and two
# calls never return the same id. Scratch workspace, real git.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/new-task-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/new-task.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

cd "$SCRATCH" || exit 2
git init -q --bare -b main origin.git
git clone -q origin.git openisd 2> /dev/null
cd openisd || exit 2
mkdir -p scripts tasks; cp "$REPO/scripts/new-task.sh" scripts/
printf 'id: T005\nowner: t\nstatus: done\n' > tasks/T005.yml
git add -A; git commit -qm base; git push -q origin main
git branch t006 main                 # a branch someone holds
mkdir "$SCRATCH/openisd-t007"        # a directory someone made

out="$(bash scripts/new-task.sh fable "Say what is done." 2>&1)"
[ "$out" = "T008 $SCRATCH/openisd-t008" ] && ok "skips T005 (task file), t006 (branch), t007 (dir): $out" || fail "first claim: $out"
[ -f "$SCRATCH/openisd-t008/tasks/T008.yml" ] && ok "task file written in the worktree" || fail "no task file"
grep -q '^owner: fable$' "$SCRATCH/openisd-t008/tasks/T008.yml" && ok "owner recorded" || fail "owner missing"
grep -q '^goal: Say what is done.$' "$SCRATCH/openisd-t008/tasks/T008.yml" && ok "goal recorded" || fail "goal missing"
[ "$(git -C "$SCRATCH/openisd-t008" log -1 --format=%s)" = "T008: task file" ] && ok "task file committed on t008" || fail "commit: $(git -C "$SCRATCH/openisd-t008" log -1 --format=%s)"

out2="$(bash scripts/new-task.sh bob 2>&1)"
[ "$out2" = "T009 $SCRATCH/openisd-t009" ] && ok "second claim is the next id: $out2" || fail "second claim: $out2"

# two claims at once never share an id
bash scripts/new-task.sh a > "$SCRATCH/a.out" 2>&1 & bash scripts/new-task.sh b > "$SCRATCH/b.out" 2>&1 & wait
ida="$(cut -d' ' -f1 "$SCRATCH/a.out")"; idb="$(cut -d' ' -f1 "$SCRATCH/b.out")"
[ -n "$ida" ] && [ -n "$idb" ] && [ "$ida" != "$idb" ] && ok "concurrent claims differ: $ida $idb" || fail "concurrent: '$ida' '$idb' $(cat "$SCRATCH/a.out" "$SCRATCH/b.out")"

[ "$fails" -eq 0 ] && echo "new-task.test: all passed" || { echo "new-task.test: $fails failed"; exit 1; }
