#!/usr/bin/env bash
# scripts/land/drop-superseded-handover.sh in a scratch repo with real git. A main-folder commit drops only when
# ALL hold: not on origin/main; every file is a root-level HANDOVER_*.md; the workspace repo commits a file of the
# same name. Its patch is saved and the drop logged. Anything else (code, a nested path, no workspace copy, a
# mixed commit, a commit already on origin/main) is left alone.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/drop-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/drop-handover.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
DROP="$REPO/scripts/land/drop-superseded-handover.sh"

# setup: origin with a base commit, the main folder (clone), a workspace repo that commits HANDOVER_bob.md.
setup() {
  rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
  git init -q --bare -b main origin.git
  git clone -q origin.git main 2> /dev/null
  printf 'a\n' > main/a.txt; git -C main add -A; git -C main commit -qm base; git -C main push -q origin main
  git init -q ws; printf 'newer\n' > ws/HANDOVER_bob.md; printf 'r\n' > ws/HANDOVER_bob.rulings.md
  git -C ws add -A; git -C ws commit -qm "bob handover"
  export HOUSEKEEPING_LOG="$SCRATCH/w/housekeeping.log" DROP_PATCH_DIR="$SCRATCH/w/patches" WORKSPACE_REPO="$SCRATCH/w/ws"
}
own() { printf 'x\n' > "$SCRATCH/w/main/$1"; git -C "$SCRATCH/w/main" add -A; git -C "$SCRATCH/w/main" commit -qm "$2"; }
run_drop() { bash "$DROP" "$SCRATCH/w/main" "$(git -C "$SCRATCH/w/main" rev-parse origin/main)"; }
head_of() { git -C "$SCRATCH/w/main" rev-parse HEAD; }

setup; own HANDOVER_bob.md "(auto) handover: bob"; own HANDOVER_bob.rulings.md "(auto) handover: bob rulings"; sha="$(head_of)"
run_drop
[ "$(head_of)" = "$(git -C "$SCRATCH/w/main" rev-parse origin/main)" ] && ok "handover-only commits with a workspace copy drop" || fail "handover-only commits with a workspace copy drop"
[ -s "$DROP_PATCH_DIR/$sha.patch" ] && ok "patch saved" || fail "patch saved"
grep -q "$sha" "$HOUSEKEEPING_LOG" && grep -q "HANDOVER_bob.rulings.md" "$HOUSEKEEPING_LOG" && grep -q "$(git -C "$SCRATCH/w/ws" rev-parse --short HEAD)" "$HOUSEKEEPING_LOG" \
  && ok "log has sha, files and the superseding workspace commit" || fail "log has sha, files and the superseding workspace commit"

setup; own HANDOVER_bob.md "(auto) handover: bob"; own src.ts "code"; before="$(head_of)"
run_drop; [ "$(head_of)" = "$before" ] && ok "a code commit blocks the drop (nothing dropped)" || fail "a code commit blocks the drop (nothing dropped)"

setup; own HANDOVER_nobody.md "(auto) handover: nobody"; before="$(head_of)"
run_drop; [ "$(head_of)" = "$before" ] && ok "no workspace copy: kept" || fail "no workspace copy: kept"

setup; mkdir -p main/docs; printf 'x\n' > main/docs/HANDOVER_bob.md; git -C "$SCRATCH/w/main" add -A; git -C "$SCRATCH/w/main" commit -qm nested; before="$(head_of)"
run_drop; [ "$(head_of)" = "$before" ] && ok "nested HANDOVER path: kept" || fail "nested HANDOVER path: kept"

setup; printf 'y\n' > main/a.txt; own HANDOVER_bob.md "one commit, code and handover"; before="$(head_of)"
run_drop; [ "$(head_of)" = "$before" ] && ok "a commit touching code and a handover: kept" || fail "a commit touching code and a handover: kept"

setup; own HANDOVER_bob.md "landed"; git -C main push -q origin main; before="$(head_of)"
run_drop; [ "$(head_of)" = "$before" ] && ok "a commit already on origin/main is not dropped" || fail "a commit already on origin/main is not dropped"

echo "failures: $fails"; exit $((fails > 0 ? 1 : 0))
