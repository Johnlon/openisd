#!/usr/bin/env bash
# T854: the task scripts find the main checkout in both layouts a clone can have:
#   (a) plain clone: <ws>/openisd/.git is the git dir, so the main checkout is dirname(git-common-dir);
#   (b) submodule of a superproject: <mono>/openisd/.git is a file, the git dir is <mono>/.git/modules/openisd and
#       core.worktree points back at the checkout, so dirname(git-common-dir) is <mono>/.git/modules (wrong).
# In each layout, from the main checkout and from a task worktree, with real git, real bare remotes (origin and the
# ship remote) and the real scripts: new-task.sh claims ids (two at once too), pr-fix.sh makes a worktree from the
# ship remote's branch, abandon.sh drops a task and refuses a branch held by the main checkout, and the shared lookup
# (scripts/lib/main-checkout.sh) names the checkout and lists it first among the worktrees. A last check: no script
# under scripts/ takes dirname(git-common-dir) as the main checkout again.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/main-checkout-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[init]\n\tdefaultBranch = main\n[protocol "file"]\n\tallow = always\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
unset WORKSPACE
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/main-checkout.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
echo "main-checkout.e2e: start $(date -u +%Y-%m-%dT%H:%M:%SZ) run ${OPENISD_RUN_ID:-none}"
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# seed <dir>: a bare origin and a bare ship remote under <dir>, origin holding the scripts under test
seed() {
  local d="$1" f
  git init -q --bare -b main "$d/origin.git"
  git init -q --bare -b main "$d/portingle.git"
  git clone -q "$d/origin.git" "$d/seed" 2> /dev/null
  for f in scripts/new-task.sh scripts/abandon.sh scripts/land/pr-fix.sh scripts/lib/main-checkout.sh; do
    [ -f "$REPO/$f" ] || continue
    mkdir -p "$d/seed/$(dirname "$f")"; cp "$REPO/$f" "$d/seed/$f"
  done
  mkdir -p "$d/seed/tasks"
  printf 'id: T005\nowner: t\nstatus: done\n' > "$d/seed/tasks/T005.yml"
  printf 'SHIP_REMOTE=portingle\nSHIP_REPO=portingle/openisd\n' > "$d/seed/ship.conf"
  git -C "$d/seed" add -A && git -C "$d/seed" commit -qm base && git -C "$d/seed" push -q origin main
  rm -rf "$d/seed"
}

# layout_a <dir>: prints the main checkout of a plain clone
layout_a() {
  seed "$1"
  git clone -q "$1/origin.git" "$1/ws/openisd" 2> /dev/null
  git -C "$1/ws/openisd" remote add portingle "$1/portingle.git"
  printf '%s\n' "$1/ws/openisd"
}

# layout_b <dir>: prints the main checkout of a submodule clone (gitdir under the superproject's .git/modules)
layout_b() {
  seed "$1"
  git init -q -b main "$1/mono"
  git -C "$1/mono" submodule add -q "$1/origin.git" openisd 2> /dev/null
  git -C "$1/mono" commit -qm "openisd as a submodule"
  git -C "$1/mono/openisd" remote add portingle "$1/portingle.git"
  printf '%s\n' "$1/mono/openisd"
}

# check <name> <main checkout>: every script's lookup in that layout
check() {
  local L="$1" main="$2" ws out out2 id dest ida idb a b r
  ws="$(dirname "$main")"
  [ -f "$main/.git" ] && [ "$L" = b ] && ok "$L: .git is a file (submodule layout)"
  [ -d "$main/.git" ] && [ "$L" = a ] && ok "$L: .git is a folder (plain layout)"

  # the shared lookup, from the main checkout and from a scratch worktree
  if [ -f "$main/scripts/lib/main-checkout.sh" ]; then
    out="$(cd "$main" && . scripts/lib/main-checkout.sh && main_checkout .)"
    [ "$out" = "$main" ] && ok "$L: main_checkout in the main checkout is $out" || fail "$L: main_checkout from main: '$out' (want $main)"
    git -C "$main" worktree add -q "$ws/scratch-wt" -b scratch 2> /dev/null
    out="$(cd "$ws/scratch-wt" && . "$main/scripts/lib/main-checkout.sh" && main_checkout .)"
    [ "$out" = "$main" ] && ok "$L: main_checkout in a worktree is the main checkout" || fail "$L: main_checkout from a worktree: '$out' (want $main)"
    out="$(. "$main/scripts/lib/main-checkout.sh" && main_worktree_list "$ws/scratch-wt" | sed -n 's/^worktree //p' | tr '\n' ' ')"
    [ "$out" = "$main $ws/scratch-wt " ] && ok "$L: main_worktree_list names the main checkout first: $out" || fail "$L: main_worktree_list: '$out' (want '$main $ws/scratch-wt ')"
    git -C "$main" worktree remove "$ws/scratch-wt"; git -C "$main" branch -q -D scratch
  else
    fail "$L: no scripts/lib/main-checkout.sh"
  fi

  # new-task.sh from the main checkout: the remote check passes, the worktree is beside the main checkout
  out="$(cd "$main" && bash scripts/new-task.sh fable "Say what is done." 2>&1)"
  [ "$out" = "T006 $ws/openisd-t006" ] && ok "$L: new-task claims T006 beside the main checkout: $out" || fail "$L: new-task from main: $out"
  [ -f "$ws/openisd-t006/tasks/T006.yml" ] && grep -q '^owner: fable$' "$ws/openisd-t006/tasks/T006.yml" \
    && [ "$(git -C "$ws/openisd-t006" log -1 --format=%s 2> /dev/null)" = "(auto) T006: task file" ] \
    && ok "$L: task file landed and committed on t006" || fail "$L: task file T006 missing or not committed"

  # new-task.sh from a task worktree: still the main checkout's workspace and branches
  out2="$( { cd "$ws/openisd-t006" && bash scripts/new-task.sh bob; } 2>&1)"
  [ "$out2" = "T007 $ws/openisd-t007" ] && ok "$L: new-task from a task worktree claims T007 beside the main checkout" || fail "$L: new-task from a worktree: $out2"
  git -C "$main" rev-parse -q --verify refs/heads/t007 > /dev/null && ok "$L: branch t007 is in the main repo" || fail "$L: no branch t007"

  # two claims at once never share an id
  (cd "$main" && bash scripts/new-task.sh a > "$ws/a.out" 2>&1) & a=$!
  (cd "$main" && bash scripts/new-task.sh b > "$ws/b.out" 2>&1) & b=$!
  wait "$a" "$b"
  ida="$(cut -d' ' -f1 "$ws/a.out")"; idb="$(cut -d' ' -f1 "$ws/b.out")"
  [ -n "$ida" ] && [ -n "$idb" ] && [ "$ida" != "$idb" ] && [ -f "$(cut -d' ' -f2 "$ws/a.out")/tasks/$ida.yml" ] \
    && [ -f "$(cut -d' ' -f2 "$ws/b.out")/tasks/$idb.yml" ] \
    && ok "$L: concurrent claims differ and both land: $ida $idb" || fail "$L: concurrent: $(cat "$ws/a.out" "$ws/b.out")"

  # pr-fix.sh: a fresh worktree from the ship remote's branch, beside the main checkout
  git -C "$main" push -q portingle main:t050
  out="$( { cd "$main" && bash scripts/land/pr-fix.sh T050; } 2>&1)"
  [ "$out" = "$ws/openisd-t050" ] && [ "$(git -C "$ws/openisd-t050" branch --show-current 2> /dev/null)" = t050 ] \
    && ok "$L: pr-fix makes $out on t050" || fail "$L: pr-fix: $out"

  # abandon.sh: drops T070 (worktree and branch); its log is in the main checkout
  git -C "$main" worktree add -q "$ws/openisd-t070" -b t070 2> /dev/null
  printf 'id: T070\nowner: t\nstatus: open\n' > "$ws/openisd-t070/tasks/T070.yml"
  git -C "$ws/openisd-t070" add tasks/T070.yml && git -C "$ws/openisd-t070" commit -qm "T070 task file"
  out="$( { cd "$main" && bash scripts/abandon.sh T070 --by lead "a test"; } 2>&1)"; r=$?
  [ $r = 0 ] && [ ! -e "$ws/openisd-t070" ] && ! git -C "$main" rev-parse -q --verify refs/heads/t070 > /dev/null \
    && grep -q 'abandoned T070 by lead' "$main/build/test-logs/tidy-branches.log" 2> /dev/null \
    && ok "$L: abandon drops T070 and logs in the main checkout" || fail "$L: abandon T070 (r=$r): $out"

  # abandon.sh refuses a branch the main checkout holds
  git -C "$main" checkout -q -b t060 2> /dev/null
  printf 'id: T060\nowner: t\nstatus: open\n' > "$main/tasks/T060.yml"
  git -C "$main" add tasks/T060.yml && git -C "$main" commit -qm "T060 task file"
  out="$( { cd "$main" && bash scripts/abandon.sh T060 --by lead "a test"; } 2>&1)"; r=$?
  [ $r = 1 ] && printf '%s' "$out" | grep -q 'checked out in the main folder' && [ -d "$main" ] \
    && ok "$L: abandon refuses the branch the main checkout holds" || fail "$L: abandon T060 (r=$r): $out"
  git -C "$main" checkout -q main
}

mkdir -p "$SCRATCH/a" "$SCRATCH/b"
check a "$(layout_a "$SCRATCH/a")"
check b "$(layout_b "$SCRATCH/b")"

# no script takes dirname(git-common-dir), or git-common-dir/.., as the main checkout
hits="$(git -C "$REPO" grep -nE 'dirname "\$common"|dirname "\$\(git [^)]*--git-common-dir|git-common-dir\)/\.\.' -- scripts ':!scripts/land/test' ':!scripts/lib/main-checkout.sh')"
[ -z "$hits" ] && ok "no script takes dirname(git-common-dir) as the main checkout" || fail "scripts still take dirname(git-common-dir): $hits"

echo "main-checkout.e2e: end $(date -u +%Y-%m-%dT%H:%M:%SZ) run ${OPENISD_RUN_ID:-none} failures $fails"
[ "$fails" -eq 0 ] && echo "main-checkout.e2e.test: all passed" || { echo "main-checkout.e2e.test: $fails failed"; exit 1; }
