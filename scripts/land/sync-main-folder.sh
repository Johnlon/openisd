#!/usr/bin/env bash
# Keeps the main folder (the main checkout) and the lap:4000 preview copy at the last commit whose GitHub run
# passed (T328, John 17 Oct 2026). Nobody runs it by hand: the watchdog runs it every tick and land.sh after
# every landing. For each copy:
#   1. Stray edits (modified, staged or untracked files) are committed there first, as one WIP commit: nothing
#      is ever lost.
#   2. It pulls with a rebase onto the last passed commit. Edits already on main drop out by themselves.
#   3. A conflict: the rebase is cancelled (the copy is back as it was, WIP commit included), and it exits 1
#      saying what to fix. Commits of its own left on top of main after a clean rebase: exits 1 saying what to
#      land. The agent fixes it: land.sh runs this after its push and refuses to call the landing finished
#      until it is fixed (John, 17 Oct 2026: the agent is responsible). The watchdog's run only logs it.
#      Exception: handover-only commits the workspace repo already holds are dropped first (drop-superseded-handover.sh).
#   4. package-lock.json changed: npm ci runs in the copy. Vite reloads the preview by itself.
# Only a passed commit is ever pulled: the last green that post-land recorded (${POST_LAND_LOCK}.green), never
# the tip of main. Every action is logged with a UTC timestamp; runs never overlap (flock in the git dir).
#
#   bash scripts/land/sync-main-folder.sh [--passed <sha>] [<any checkout of the repo>]
#   --passed: land.sh names the commit it just pushed, whose candidate run passed (post-land records it later).
#
# Copies: the main folder, plus each path in the repo's git config openisd.syncedCopy (the preview, which stays
# a detached worktree). Env: SYNC_LOG (default <main>/build/test-logs/sync-main-folder.log), SYNC_NPM (default
# npm), POST_LAND_LOCK / OPENISD_RUNTIME_DIR (scripts/paths.sh).
# Exit 0 every copy at the last passed commit, 1 a copy is held (conflict, own commits, git failure): logged.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../paths.sh
. "$HERE/../paths.sh"

passed=""
[ "${1:-}" = --passed ] && { passed="${2:?--passed needs a sha}"; shift 2; }
repo="${1:-.}"
common="$(cd "$repo" && cd "$(git rev-parse --git-common-dir)" && pwd)" || { echo "sync-main-folder: $repo is not a git checkout" >&2; exit 1; }
main="$(dirname "$common")"
LOG="${SYNC_LOG:-$main/build/test-logs/sync-main-folder.log}"
NPM="${SYNC_NPM:-npm}"
GREEN="${POST_LAND_LOCK}.green"

mkdir -p "$(dirname "$LOG")"
log() { printf '%s sync-main-folder: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" | tee -a "$LOG"; }

exec 8> "$common/sync-main-folder.lock" || { log "cannot open $common/sync-main-folder.lock"; exit 1; }
flock -n 8 || { echo "sync-main-folder: another run is syncing"; exit 0; }

# Tools that write refuse to run here (scripts/lib/main-folder.sh).
[ "$(git -C "$main" config --get openisd.mainFolder)" = "$main" ] || git -C "$main" config openisd.mainFolder "$main"
timeout 120 git -C "$main" fetch -q origin main || { log "cannot fetch origin main; nothing moved"; exit 1; }
target="${passed:-$(cat "$GREEN" 2> /dev/null)}"
[ -n "$target" ] || { log "no passed commit recorded ($GREEN); nothing moved"; exit 1; }
git -C "$main" merge-base --is-ancestor "$target" origin/main 2> /dev/null \
  || { log "the last passed commit ${target:0:10} is not on origin/main; nothing moved"; exit 1; }

# sync <copy>: commit its stray edits, then rebase it onto the last passed commit.
sync() {
  local copy="$1" name gd head lock_before ahead rebase_out
  [ "$copy" = "$main" ] && name="main folder" || name="$(basename "$copy")"
  [ -d "$copy" ] || { log "$name: $copy is listed but missing; skipped"; return 0; }
  g() { git -C "$copy" "$@"; }
  gd="$(g rev-parse --absolute-git-dir)" || { log "$name: not a git checkout"; return 1; }
  for f in rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD; do
    [ -e "$gd/$f" ] && { log "$name: a rebase or merge is already in progress ($f); left for someone to finish"; return 1; }
  done
  head="$(g rev-parse HEAD)" || return 1
  lock_before="$(g rev-parse -q --verify HEAD:package-lock.json)"

  if [ -n "$(g status --porcelain --untracked-files=all)" ]; then
    g add -A && g commit -q -m "WIP $name: stray edits, committed by sync-main-folder $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      || { log "$name: could not commit its stray edits; not moved"; return 1; }
    log "$name: committed stray edits as $(g rev-parse --short HEAD): $(g show --name-only --format= HEAD | tr '\n' ' ')"
  fi

  if [ "$copy" != "$main" ] && [ -z "$(g symbolic-ref -q HEAD)" ] && [ "$(g rev-list --count "$target..HEAD")" = 0 ]; then
    g checkout -q --detach "$target" || { log "$name: could not move to ${target:0:10}"; return 1; }
  elif ! rebase_out="$(g rebase -q "$target" 2>&1)"; then
    if [ ! -e "$gd/rebase-merge" ] && [ ! -e "$gd/rebase-apply" ]; then
      log "$name: git refused to rebase onto ${target:0:10} (no conflict): $(head -3 <<< "$rebase_out" | tr '\n' ' ')"
      echo "sync-main-folder: to fix, in $copy: see why git refused, then rerun" >&2
      return 1
    fi
    local conflicts; conflicts="$(g diff --name-only --diff-filter=U | tr '\n' ' ')"
    g rebase --abort
    log "$name: CONFLICT rebasing onto ${target:0:10} in $conflicts; cancelled, left at ${head:0:10} for someone to fix"
    echo "sync-main-folder: to fix, in $copy: git rebase ${target:0:10}, resolve, then land what is wanted from a worktree" >&2
    return 1
  fi

  [ "$copy" = "$main" ] && bash "$HERE/drop-superseded-handover.sh" "$copy" "$target"   # handover-only commits the workspace repo already holds
  ahead="$(g rev-list --count "$target..HEAD")"
  [ "$(g rev-parse HEAD)" = "$head" ] || log "$name: moved ${head:0:10} -> $(g rev-parse --short=10 HEAD)"
  if [ "$ahead" != 0 ]; then
    log "$name: $ahead commit(s) of its own are on top of main; left for someone to land or drop"
    echo "sync-main-folder: to fix, land what is wanted from a worktree (they then drop out by themselves): $(g log --format='%h %s' "$target..HEAD" | head -10 | tr '\n' ';')" >&2
    return 1
  fi

  if [ "$lock_before" != "$(g rev-parse -q --verify HEAD:package-lock.json)" ]; then
    log "$name: package-lock.json changed; running npm ci"
    (cd "$copy" && "$NPM" ci --no-audit --no-fund >> "$LOG" 2>&1) || { log "$name: npm ci FAILED"; return 1; }
    log "$name: npm ci done"
  fi
}

status=0
sync "$main" || status=1
while read -r copy; do
  [ -n "$copy" ] && { sync "$copy" || status=1; }
done < <(git -C "$main" config --get-all openisd.syncedCopy)
exit "$status"
