#!/usr/bin/env bash
# Drops handover-only commits from a copy of the repo (the main folder) when the workspace repo already holds them.
# A copy may not carry commits of its own (sync-main-folder.sh holds it), and a handover written there is not
# something to land. Rule (fable, 17 Oct 2026): the commits between <target> and HEAD are dropped only when EVERY
# one of them satisfies ALL of:
#   1. it is not on origin/main;
#   2. every file it touches is a root-level HANDOVER_*.md (so no code ever drops);
#   3. the workspace repo commits a file of the same name (identical or newer: the superseded case).
# One commit that fails a test keeps the whole set. Before the drop each patch is saved to
# <main>/build/test-logs/dropped-commits/<sha>.patch and the sha, subject, files and the superseding workspace
# commit of each file are logged in housekeeping.log.
#
#   bash scripts/land/drop-superseded-handover.sh <copy> <target-sha>
# Env: WORKSPACE_REPO (default: the parent of the main folder), HOUSEKEEPING_LOG, DROP_PATCH_DIR.
# Exit 0 nothing to drop, or dropped; 1 a git failure.
set -uo pipefail
copy="${1:?copy}"; target="${2:?target sha}"
g() { git -C "$copy" "$@"; }
common="$(cd "$copy" && cd "$(git rev-parse --git-common-dir)" && pwd)" || exit 1
main="$(dirname "$common")"
WS="${WORKSPACE_REPO:-$(dirname "$main")}"
LOG="${HOUSEKEEPING_LOG:-$main/build/test-logs/housekeeping.log}"
PATCHES="${DROP_PATCH_DIR:-$main/build/test-logs/dropped-commits}"
log() { printf '%s drop-superseded-handover: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >> "$LOG"; }

mapfile -t shas < <(g rev-list "$target..HEAD")
[ "${#shas[@]}" -gt 0 ] || exit 0
[ -z "$(g status --porcelain --untracked-files=all)" ] || exit 0

report=""
for sha in "${shas[@]}"; do
  g merge-base --is-ancestor "$sha" origin/main 2> /dev/null && exit 0
  mapfile -t files < <(g show --name-only --format= "$sha")
  [ "${#files[@]}" -gt 0 ] || exit 0
  for f in "${files[@]}"; do
    [[ "$f" =~ ^HANDOVER_[^/]+\.md$ ]] || exit 0
    git -C "$WS" cat-file -e "HEAD:$f" 2> /dev/null || exit 0
    report+="$sha $(g log -1 --format=%s "$sha") | $f superseded by workspace commit $(git -C "$WS" log -1 --format=%h -- "$f")"$'\n'
  done
done

mkdir -p "$PATCHES" "$(dirname "$LOG")"
for sha in "${shas[@]}"; do g format-patch -1 --stdout "$sha" > "$PATCHES/$sha.patch" || exit 1; done
g reset -q --hard "$target" || { log "reset to ${target:0:10} FAILED; nothing dropped"; exit 1; }
log "dropped ${#shas[@]} commit(s) from $copy, patches in $PATCHES:"
while IFS= read -r line; do [ -n "$line" ] && log "  $line"; done <<< "$report"
