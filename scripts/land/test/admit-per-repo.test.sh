#!/usr/bin/env bash
# One admission slot PER REPO (John 2026-10-08: nothing in tools may slow openisd).
# With ADMIT_DIR unset, the slot directory is /tmp/<repo>-admit, where <repo> is the directory name
# of the repo the command runs in (a git worktree maps to its main repo). A slot held in one repo
# never makes a run in another repo wait; two runs in the same repo still queue. Not a locked spec.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/admit-repo-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/admit-per-repo.XXXXXX")"
NAME_A="zz-admit-a-$$"
NAME_B="zz-admit-b-$$"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG" "/tmp/$NAME_A-admit" "/tmp/$NAME_B-admit"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

unset ADMIT_DIR ADMIT_TOKEN
for n in "$NAME_A" "$NAME_B"; do
    mkdir -p "$SCRATCH/$n"; git -C "$SCRATCH/$n" init -q
    git -C "$SCRATCH/$n" commit -q --allow-empty -m base
    mkdir -p "$SCRATCH/$n/scripts"; cp -r "$REPO/scripts/admit" "$REPO/scripts/lib" "$REPO/scripts/admit.sh" "$SCRATCH/$n/scripts/"
done
git -C "$SCRATCH/$NAME_A" worktree add -q "$SCRATCH/wt-of-a" -b other 2>/dev/null
cp -r "$SCRATCH/$NAME_A/scripts" "$SCRATCH/wt-of-a/" 2>/dev/null

run_in() { # run_in <dir> <label> <command...>: admit.sh from that dir
    local d=$1 label=$2; shift 2
    ( cd "$d" && exec bash scripts/admit.sh "$label" -- "$@" )
}

# 1. the slot directory is named after the repo
run_in "$SCRATCH/$NAME_A" hold true > /dev/null 2>&1
[ -d "/tmp/$NAME_A-admit" ] && ok "slot dir is /tmp/<repo>-admit" || fail "no /tmp/$NAME_A-admit"
[ ! -d /tmp/openisd-admit/q/zz ] && true

# 2. a slot held in repo A: a run in repo B starts at once
run_in "$SCRATCH/$NAME_A" holder sleep 20 > /dev/null 2>&1 & holder=$!
for _ in $(seq 1 50); do ls "/tmp/$NAME_A-admit/q"/*.rec > /dev/null 2>&1 && break; sleep 0.1; done
t0=$(date +%s)
timeout 15 bash -c "cd '$SCRATCH/$NAME_B' && bash scripts/admit.sh other-repo -- true" > "$SCRATCH/b.out" 2>&1; rb=$?
t1=$(date +%s)
if [ $rb = 0 ] && [ $((t1 - t0)) -lt 8 ]; then ok "a held slot in repo A does not delay repo B"
else fail "repo B waited or failed (rc=$rb, $((t1 - t0))s): $(head -c 200 "$SCRATCH/b.out")"; fi

# 3. the same repo still queues behind the holder (the worktree of A counts as A)
timeout 4 bash -c "cd '$SCRATCH/wt-of-a' && bash scripts/admit.sh same-repo -- true" > "$SCRATCH/a.out" 2>&1; ra=$?
if [ $ra != 0 ] && grep -q "waiting" "$SCRATCH/a.out"; then ok "same repo (and its worktree) still waits behind the holder"
else fail "same repo did not wait (rc=$ra): $(head -c 200 "$SCRATCH/a.out")"; fi

kill "$holder" 2>/dev/null; wait "$holder" 2>/dev/null

# 4. an explicit ADMIT_DIR still wins
ADMIT_DIR="$SCRATCH/explicit" run_in "$SCRATCH/$NAME_B" ex true > /dev/null 2>&1
[ -d "$SCRATCH/explicit/q" ] && ok "explicit ADMIT_DIR wins" || fail "explicit ADMIT_DIR ignored"

[ $fails = 0 ] && { echo "admit-per-repo: all passed"; exit 0; }
echo "admit-per-repo: $fails failed"; exit 1
