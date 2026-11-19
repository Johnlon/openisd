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
yget() { python3 -c 'import sys,yaml; print(yaml.safe_load(open(sys.argv[1]))[sys.argv[2]], end="")' "$1" "$2"; }
[ "$(yget "$SCRATCH/openisd-t008/tasks/T008.yml" owner)" = "fable" ] && ok "owner recorded" || fail "owner missing"
[ "$(yget "$SCRATCH/openisd-t008/tasks/T008.yml" goal)" = "Say what is done." ] && ok "goal recorded" || fail "goal missing"
[ "$(git -C "$SCRATCH/openisd-t008" log -1 --format=%s)" = "(auto) T008: task file" ] && ok "task file committed on t008" || fail "commit: $(git -C "$SCRATCH/openisd-t008" log -1 --format=%s)"

out2="$(bash scripts/new-task.sh bob 2>&1)"
[ "$out2" = "T009 $SCRATCH/openisd-t009" ] && ok "second claim is the next id: $out2" || fail "second claim: $out2"

out3="$(bash scripts/new-task.sh carol "G." "Because John said so (John, 10 Nov 2026)" 2>&1)"; id3="${out3%% *}"
[ "$(yget "${out3#* }/tasks/$id3.yml" why)" = "Because John said so (John, 10 Nov 2026)" ] && ok "why recorded from the third argument" || fail "why missing: $out3"

# T931: free text with ': ', quotes, '#' must survive as valid YAML and come back exactly
g="Engine: a: b 'quoted' # not a comment"; w="lead 19 Nov 2026: x"
out6="$(bash scripts/new-task.sh zed "$g" "$w" 2>&1)"; f6="${out6#* }/tasks/${out6%% *}.yml"
[ "$(yget "$f6" goal 2>&1)" = "$g" ] && [ "$(yget "$f6" why 2>&1)" = "$w" ] && ok "goal and why with colon, quotes and # parse back exactly" || fail "yaml-unsafe text: $out6 / $(yget "$f6" goal 2>&1)"
for lead in '#x' '- x' '"x' '@x' '%x' '[x]' '{x}' '&x' '*x' '!x' '|x' '>x' '? x' 'true' '123' '~'; do
  o="$(bash scripts/new-task.sh zed "$lead" "$lead" 2>&1)"; f="${o#* }/tasks/${o%% *}.yml"
  [ "$(yget "$f" goal 2>&1)" = "$lead" ] && [ "$(yget "$f" why 2>&1)" = "$lead" ] && ok "value '$lead' round-trips" || fail "value '$lead': $o"
done

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

# A hard-linked node_modules that does not match the new worktree's package-lock.json gets npm ci (stub npm in PATH);
# one that matches does not. Optional packages absent on this platform do not count as stale.
git remote add portingle "$SCRATCH/portingle.git"
mkdir -p "$SCRATCH/bin" node_modules/a
printf '#!/bin/sh\necho "npm $*" >> "%s/npm.calls"\n' "$SCRATCH" > "$SCRATCH/bin/npm"; chmod +x "$SCRATCH/bin/npm"
lock() { printf '{"packages":{"":{},"node_modules/a":{"version":"1.0.0"},"node_modules/b":{"version":"%s"},"node_modules/opt":{"version":"1.0.0","optional":true}}}' "$1"; }
inst() { printf '{"packages":{"node_modules/a":{"version":"1.0.0"},"node_modules/b":{"version":"%s"}}}' "$1" > node_modules/.package-lock.json; }
lock 2.0.0 > package-lock.json; inst 2.0.0
git add package-lock.json; git commit -qm lock; git push -q origin main   # node_modules is untracked: the main checkout's own
: > "$SCRATCH/npm.calls"
out6="$(PATH="$SCRATCH/bin:$PATH" bash scripts/new-task.sh gina 2>&1)"
[ ! -s "$SCRATCH/npm.calls" ] && ok "matching node_modules: no npm ci" || fail "npm ran for a matching node_modules: $(cat "$SCRATCH/npm.calls")"
inst 1.0.0   # now older than the lockfile
out7="$(PATH="$SCRATCH/bin:$PATH" bash scripts/new-task.sh hal 2>&1)"
grep -q '^npm ci' "$SCRATCH/npm.calls" && ok "stale node_modules: npm ci ran" || fail "npm ci did not run for a stale node_modules: $out7"
[ "$(wc -l < "$SCRATCH/npm.calls")" = 1 ] && ok "npm ci ran once" || fail "npm calls: $(cat "$SCRATCH/npm.calls")"
printf '{"packages":{"node_modules/a":{"version":"1.0.0"}}}' > node_modules/.package-lock.json   # lz-string case: a package missing
: > "$SCRATCH/npm.calls"
PATH="$SCRATCH/bin:$PATH" bash scripts/new-task.sh ivy > /dev/null 2>&1
grep -q '^npm ci' "$SCRATCH/npm.calls" && ok "missing package: npm ci ran" || fail "npm ci did not run for a missing package"

[ "$fails" -eq 0 ] && echo "new-task.test: all passed" || { echo "new-task.test: $fails failed"; exit 1; }
