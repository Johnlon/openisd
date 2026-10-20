#!/usr/bin/env bash
# Keeps the main folder (the main checkout) and the lap:4000 preview copy at the last commit whose GitHub run
# passed (T328, John 17 Oct 2026). Nobody runs it by hand: the watchdog runs it every tick and land.sh after
# every landing. It can never get stuck (T476, John 19 Oct 2026): it never rebases, never conflicts, and never
# commits onto the copy's own main. For each copy:
#   1. Untracked files are never touched: they stay where they are, on disk and on no branch (T485, John 20 Oct
#      2026: a sync swept his file into a stray branch). One at a path the passed commit adds would be overwritten
#      by the move: the copy is held, logged, exit 1. Stray edits to tracked files (modified, staged, deleted)
#      are committed to a new branch stray/<UTC yyyymmddThhmmssZ>
#      made from the copy's current HEAD (hooks off for that commit); the working tree then returns to the state
#      of the branch it was on, so the copy's main is unchanged by the commit.
#   2. Commits of the copy's own that are not on the passed commit are kept on a stray/ branch the same way (one
#      branch holds both). The copy's main is reset to the passed commit ONLY after the branch ref exists and is
#      verified to contain them.
#   3. Otherwise main moves with git merge --ff-only <passed commit>.
#   4. Every stray branch made is logged (STRAY) and printed; someone lands what is wanted from it. Exit stays 0.
#      Exception: handover-only commits the workspace repo already holds are dropped first (drop-superseded-handover.sh).
#   5. package-lock.json changed: npm ci runs in the copy.
#   6. The main folder moved to a new commit: the openisd-preview unit (Vite on the main folder) is restarted, if
#      installed. Vite does not cope with a branch moving under it: it serves a mix of old and new modules (T427).
#      A failed restart is logged and exits 1.
# Only a passed commit is ever pulled: the last green that post-land recorded (${POST_LAND_RECORD}.green), never
# the tip of main. Every action is logged with a UTC timestamp; runs never overlap (flock in the git dir).
#
#   bash scripts/land/sync-main-folder.sh [--passed <sha>] [<any checkout of the repo>]
#   --passed: land.sh names the commit it just pushed, whose candidate run passed (post-land records it later).
#
# Copies: the main folder, plus each path in the repo's git config openisd.syncedCopy (the preview, which stays
# a detached worktree). Env: SYNC_LOG (default <main>/build/test-logs/sync-main-folder.log), SYNC_NPM (default
# npm), SYNC_SYSTEMCTL (default systemctl), POST_LAND_RECORD / OPENISD_STATE_DIR (scripts/paths.sh).
# Exit 0 every copy at the last passed commit (stray branches made are not a failure), 1 a copy is held (git
# failure, a stray branch that could not be made or verified): logged.
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
SYSTEMCTL="${SYNC_SYSTEMCTL:-systemctl}"
PREVIEW_UNIT=openisd-preview
GREEN="${POST_LAND_RECORD}.green"

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

# stray_branch <copy> <name> <head>: put the copy's stray edits and own commits on stray/<utc time> (made from
# <head>), verified, and leave the copy as it was at <head> with a clean tree. Prints the branch name.
stray_branch() {
  local copy="$1" name="$2" head="$3" ref base branch n=0
  g() { git -C "$copy" "$@"; }
  ref="$(g symbolic-ref -q HEAD)"
  base="stray/$(date -u +%Y%m%dT%H%M%SZ)"; [ "$copy" = "$main" ] || base="$base-$(basename "$copy")"
  branch="$base"
  while g show-ref -q --verify "refs/heads/$branch"; do n=$((n + 1)); branch="$base-$n"; done
  if [ -n "$(g status --porcelain --untracked-files=no)" ]; then
    g checkout -q -b "$branch" || { log "$name: could not make $branch; not moved"; return 1; }
    g add -u && g -c core.hooksPath=/dev/null commit -q -m "WIP $name: stray edits, committed by sync-main-folder" \
      || { log "$name: could not commit its stray edits to $branch; not moved"; return 1; }
    [ -z "$(g status --porcelain --untracked-files=no)" ] || { log "$name: tree still dirty after the commit on $branch; not moved"; return 1; }
    if [ -n "$ref" ]; then g checkout -q "${ref#refs/heads/}"; else g checkout -q --detach "$head"; fi \
      || { log "$name: could not return to ${ref:-$head} from $branch; stray work is safe on $branch"; return 1; }
  else
    g branch "$branch" "$head" || { log "$name: could not make $branch; not moved"; return 1; }
  fi
  g merge-base --is-ancestor "$head" "refs/heads/$branch" 2> /dev/null \
    || { log "$name: $branch does not hold ${head:0:10}; not moved"; return 1; }
  log "STRAY $name: kept on branch $branch ($(g rev-list --count "$target..$branch") commit(s) not on main): $(g diff --name-only "$head" "$branch" | tr '\n' ' ')"
  echo "sync-main-folder: stray work from $name is on branch $branch; land what is wanted from a worktree" >&2
}

# sync <copy>: keep its stray work on a stray/ branch, then move it to the last passed commit.
sync() {
  local copy="$1" name gd head lock_before ahead
  [ "$copy" = "$main" ] && name="main folder" || name="$(basename "$copy")"
  [ -d "$copy" ] || { log "$name: $copy is listed but missing; skipped"; return 0; }
  g() { git -C "$copy" "$@"; }
  gd="$(g rev-parse --absolute-git-dir)" || { log "$name: not a git checkout"; return 1; }
  for f in rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD; do
    [ -e "$gd/$f" ] && { log "$name: a rebase or merge is already in progress ($f); left for someone to finish"; return 1; }
  done
  head="$(g rev-parse HEAD)" || return 1
  lock_before="$(g rev-parse -q --verify HEAD:package-lock.json)"

  if [ "$copy" = "$main" ]; then   # handover-only commits the workspace repo already holds
    bash "$HERE/drop-superseded-handover.sh" "$copy" "$target"; head="$(g rev-parse HEAD)" || return 1
  fi
  ahead="$(g rev-list --count "$target..HEAD")" || return 1
  while IFS= read -r f; do
    g cat-file -e "$target:$f" 2> /dev/null && { log "$name: untracked $f would be overwritten by ${target:0:10}; not moved"; return 1; }
  done < <(g ls-files --others --exclude-standard)
  if [ -n "$(g status --porcelain --untracked-files=no)" ] || [ "$ahead" != 0 ]; then
    stray_branch "$copy" "$name" "$head" || return 1
  fi
  if [ "$ahead" != 0 ]; then
    g reset -q --hard "$target" || { log "$name: could not reset to ${target:0:10}; its commits are safe on the stray branch"; return 1; }
  elif ! g merge -q --ff-only "$target" 2> /dev/null; then
    log "$name: could not fast-forward ${head:0:10} -> ${target:0:10}"; return 1
  fi
  [ "$(g rev-parse HEAD)" = "$head" ] || log "$name: moved ${head:0:10} -> $(g rev-parse --short=10 HEAD)"

  if [ "$lock_before" != "$(g rev-parse -q --verify HEAD:package-lock.json)" ]; then
    log "$name: package-lock.json changed; running npm ci"
    (cd "$copy" && "$NPM" ci --no-audit --no-fund >> "$LOG" 2>&1) || { log "$name: npm ci FAILED"; return 1; }
    log "$name: npm ci done"
  fi
}

# restart_preview: Vite on the main folder serves stale modules after the folder moves under it.
restart_preview() {
  "$SYSTEMCTL" --user cat "$PREVIEW_UNIT" > /dev/null 2>&1 || { log "no $PREVIEW_UNIT unit; preview not restarted"; return 0; }
  if "$SYSTEMCTL" --user restart "$PREVIEW_UNIT" >> "$LOG" 2>&1; then log "main folder moved: restarted $PREVIEW_UNIT"
  else log "preview restart FAILED: systemctl --user restart $PREVIEW_UNIT; the preview may serve stale modules, run scripts/preview-4000.sh"; return 1; fi
}

status=0
main_before="$(git -C "$main" rev-parse HEAD)"
sync "$main" || status=1
[ "$(git -C "$main" rev-parse HEAD)" = "$main_before" ] || restart_preview || status=1
while read -r copy; do
  [ -n "$copy" ] && { sync "$copy" || status=1; }
done < <(git -C "$main" config --get-all openisd.syncedCopy)
exit "$status"
