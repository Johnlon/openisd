#!/usr/bin/env bash
# T083: new-task.sh hands out ids atomically: it skips ids taken by a branch, a directory or a task
# file, claims the next with git branch + mkdir, adds the worktree, commits the task file, and two
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
git init -q --bare -b main portingle.git
git clone -q origin.git openisd 2> /dev/null
cd openisd || exit 2
mkdir -p scripts/lib tasks; cp "$REPO/scripts/new-task.sh" scripts/; cp "$REPO/scripts/lib/main-checkout.sh" scripts/lib/
printf 'id: T005\nowner: t\nstatus: done\n' > tasks/T005.yml
printf 'SHIP_REMOTE=portingle\nSHIP_REPO=portingle/openisd\n' > ship.conf
git remote add portingle "$SCRATCH/portingle.git"
git add -A; git commit -qm base; git push -q origin main
git branch t006 main                 # a branch someone holds
mkdir "$SCRATCH/openisd-t007"        # a directory someone made

out="$(bash scripts/new-task.sh fable "Say what is done." 2>&1)"
[ "$out" = "T008 $SCRATCH/openisd-t008" ] && ok "skips T005 (task file), t006 (branch), t007 (dir): $out" || fail "first claim: $out"
[ -f "$SCRATCH/openisd-t008/tasks/T008.yml" ] && ok "task file written in the worktree" || fail "no task file"
grep -q '^owner: fable$' "$SCRATCH/openisd-t008/tasks/T008.yml" && ok "owner recorded" || fail "owner missing"
grep -q '^goal: Say what is done.$' "$SCRATCH/openisd-t008/tasks/T008.yml" && ok "goal recorded" || fail "goal missing"
[ "$(git -C "$SCRATCH/openisd-t008" log -1 --format=%s)" = "(auto) T008: task file" ] && ok "task file committed on t008" || fail "commit: $(git -C "$SCRATCH/openisd-t008" log -1 --format=%s)"

out2="$(bash scripts/new-task.sh bob 2>&1)"
[ "$out2" = "T009 $SCRATCH/openisd-t009" ] && ok "second claim is the next id: $out2" || fail "second claim: $out2"

out3="$(bash scripts/new-task.sh carol "G." "Because John said so (John, 10 Nov 2026)" 2>&1)"; id3="${out3%% *}"
grep -q '^why: Because John said so (John, 10 Nov 2026)$' "${out3#* }/tasks/$id3.yml" && ok "why recorded from the third argument" || fail "why missing: $out3"

# two claims at once never share an id
bash scripts/new-task.sh a > "$SCRATCH/a.out" 2>&1 & bash scripts/new-task.sh b > "$SCRATCH/b.out" 2>&1 & wait
ida="$(cut -d' ' -f1 "$SCRATCH/a.out")"; idb="$(cut -d' ' -f1 "$SCRATCH/b.out")"
[ -n "$ida" ] && [ -n "$idb" ] && [ "$ida" != "$idb" ] && ok "concurrent claims differ: $ida $idb" || fail "concurrent: '$ida' '$idb' $(cat "$SCRATCH/a.out" "$SCRATCH/b.out")"

# T792 (QO920): an id that exists only on the ship remote is skipped. The fetch is made useless so only ls-remote can see it.
git config remote.portingle.fetch '+refs/heads/nothing:refs/remotes/portingle/nothing'
git push -q portingle main:t030
out4="$(bash scripts/new-task.sh dave 2>&1)"
[ "${out4%% *}" = "T031" ] && ok "skips t030, which only the ship remote has: $out4" || fail "ship-remote id: $out4"
git push -q origin main:t040
out4b="$(bash scripts/new-task.sh dave 2>&1)"
[ "${out4b%% *}" = "T041" ] && ok "skips t040, which only origin has (live heads): $out4b" || fail "origin id: $out4b"

# two claims at once with the ship remote in play still differ
bash scripts/new-task.sh a > "$SCRATCH/a.out" 2>&1 & bash scripts/new-task.sh b > "$SCRATCH/b.out" 2>&1 & wait
ida="$(cut -d' ' -f1 "$SCRATCH/a.out")"; idb="$(cut -d' ' -f1 "$SCRATCH/b.out")"
[ -n "$ida" ] && [ -n "$idb" ] && [ "$ida" != "$idb" ] && ok "concurrent claims differ again: $ida $idb" || fail "concurrent 2: '$ida' '$idb'"

# no ship remote configured: refuse, claim nothing, say the exact command
git remote remove portingle
before="$(ls -d "$SCRATCH"/openisd-t* | wc -l)"; brbefore="$(git branch --list 't*' | wc -l)"
out5="$(bash scripts/new-task.sh erin 2>&1)"; r=$?
[ $r = 1 ] && printf '%s' "$out5" | grep -q 'git remote add portingle git@github.com:portingle/openisd.git' \
  && [ "$(ls -d "$SCRATCH"/openisd-t* | wc -l)" = "$before" ] && [ "$(git branch --list 't*' | wc -l)" = "$brbefore" ] \
  && ok "refuses without the ship remote, names the git remote add, claims nothing" || fail "no ship remote (r=$r): $out5"

[ "$fails" -eq 0 ] && echo "new-task.test: all passed" || { echo "new-task.test: $fails failed"; exit 1; }
