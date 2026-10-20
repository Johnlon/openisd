#!/usr/bin/env bash
# Removes the task branches, worktrees and folders whose work is safe elsewhere (T334, John 17 Oct 2026: "I don't
# want dead branches and worktrees lying around"). The watchdog runs it every tick. Nothing is ever removed that holds work found nowhere else:
#   - a worktree beside the main folder (<workspace>/<repo>-*) goes when it is clean (no modified or untracked
#     file), no running program has its folder inside it, and its HEAD is on origin/main (by commit or by
#     content, as for branches below). A claim (.task) left in it is logged as stale.
#     A worktree anywhere else (a run's or a scratch copy) goes on the same terms once its HEAD is 6 h old
#     (TIDY_OTHER_MIN_AGE_S). The main folder and the synced copies (git config openisd.mainFolder /
#     openisd.syncedCopy) are never touched;
#   - a task branch (t<n>), local or on origin, goes when it is checked out nowhere and every commit on it is on
#     origin/main, or its content is (merging it changes nothing but its own task file, once main says the task
#     is done: land.sh squashes). A land/<task> candidate branch on origin
#     goes when it is on origin/main;
#   - a folder <workspace>/<repo>-* that is not a worktree and has no git data goes when it holds only generated
#     folders (node_modules, build, test-results, playwright-report, dist, .vite), and is more than a day old.
# Every removal and every kept item with a reason is logged with a UTC timestamp.
#
#   bash scripts/land/tidy-branches.sh [--only T<n>] [<any checkout of the repo>]
#
# Nothing is archived (John, 17 Oct 2026: no archive refs): a deleted branch's only record is its log line, with its
# tip sha and the reason. Abandoned work is not tidied here: scripts/abandon.sh deletes it on a decision and writes
# its own line to this same log (T355). Env: TIDY_LOG (default <main>/build/test-logs/tidy-branches.log), WORKSPACE
# (default the main folder's parent). Exit 0, or 1 when git could not be read.
set -uo pipefail

only=""
[ "${1:-}" = --only ] && { only="${2:?--only needs a task id}"; shift 2; }
repo="${1:-.}"
common="$(cd "$repo" && cd "$(git rev-parse --git-common-dir)" && pwd)" || { echo "tidy-branches: $repo is not a git checkout" >&2; exit 1; }
main="$(dirname "$common")"
name="$(basename "$main")"
WORKSPACE="${WORKSPACE:-$(dirname "$main")}"
LOG="${TIDY_LOG:-$main/build/test-logs/tidy-branches.log}"
OTHER_MIN_AGE_S="${TIDY_OTHER_MIN_AGE_S:-21600}"
mkdir -p "$(dirname "$LOG")"
log() { printf '%s tidy-branches: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" | tee -a "$LOG"; }
g() { git -C "$main" "$@"; }

exec 8> "$common/tidy-branches.lock" || { log "cannot open $common/tidy-branches.lock"; exit 1; }
flock -n 8 || { echo "tidy-branches: another run is tidying"; exit 0; }
timeout 120 git -C "$main" fetch -q --prune origin || { log "cannot fetch origin; nothing removed"; exit 1; }
g rev-parse -q --verify origin/main > /dev/null || { log "no origin/main; nothing removed"; exit 1; }

# in_content <commit> <branch>: merging the commit into origin/main changes nothing. land.sh squashes, so a landed
# task's branch shas are never on main; this finds it by content. The task's own tasks/T<n>.yml may differ (or
# conflict) once main says the task is done: main's copy is the record.
in_content() {
  local tree main_tree id="" conflicts
  main_tree="$(g rev-parse 'origin/main^{tree}')"
  tree="$(g merge-tree --write-tree --name-only origin/main "$1" 2> /dev/null | head -n 1)" || true
  [ "$tree" = "$main_tree" ] && return 0
  case "$2" in t[0-9]*) id="T${2#t}" ;; *) return 1 ;; esac
  [ -n "$tree" ] && g show "origin/main:tasks/$id.yml" 2> /dev/null | grep -qx 'status: done' || return 1
  conflicts="$(g merge-tree --write-tree --name-only origin/main "$1" 2> /dev/null | sed -n '2,/^$/p' | grep -v '^$')"
  [ -z "$(grep -vxF "tasks/$id.yml" <<< "$conflicts")" ] || return 1
  g diff --quiet "$main_tree" "$tree" -- . ":(exclude)tasks/$id.yml"
}
# safe <commit> <branch>: every commit is on origin/main, or its content is.
safe() {
  g merge-base --is-ancestor "$1" origin/main 2> /dev/null && return 0
  in_content "$1" "$2"
}
wanted() { [ -z "$only" ] || [ "$1" = "t${only#T}" ]; }
CWDS=""   # every process's current folder, read once per run
in_use() { # in_use <dir>: a running program's current folder is inside it
  [ -n "$CWDS" ] || CWDS="$(find /proc/[0-9]*/cwd -maxdepth 0 -printf '%l/\n' 2> /dev/null; echo -)"
  awk -v d="$1/" 'index($0, d) == 1 { f = 1 } END { exit !f }' <<< "$CWDS"
}
keep_list="$( { g config --get openisd.mainFolder; g config --get-all openisd.syncedCopy; echo "$main"; } 2> /dev/null)"

# --- worktrees ---------------------------------------------------------------------------------------------------
declare -A wt_paths=()
tidy_worktree() { # tidy_worktree <path> <branch or empty>
  local wt="$1" br="$2" head claim
  wt_paths["$wt"]=1
  grep -qxF -- "$wt" <<< "$keep_list" && return 0
  wanted "$br" || return 0
  head="$(git -C "$wt" rev-parse HEAD 2> /dev/null)" || { log "kept $wt: cannot read HEAD"; return 0; }
  # A worktree without a task name (a run's copy, a scratch copy) goes only once it is OTHER_MIN_AGE_S old: no run
  # lives that long (the longest deadline is 90 min), so a live run's copy is never taken between its steps.
  case "$wt" in
    "$WORKSPACE/$name"-*) ;;
    *) [ $(( $(date +%s) - $(stat -c %Y "$(git -C "$wt" rev-parse --absolute-git-dir 2> /dev/null)/HEAD" 2> /dev/null || date +%s) )) \
         -ge "$OTHER_MIN_AGE_S" ] || return 0 ;;
  esac
  safe "$head" "$br" || return 0
  if [ -n "$(git -C "$wt" status --porcelain --untracked-files=all 2> /dev/null)" ]; then
    log "kept $wt: uncommitted work"
    return 0
  fi
  in_use "$wt" && { log "kept $wt: a running program is inside it"; return 0; }
  claim="$(cat "$wt/.task" 2> /dev/null)"
  if g worktree remove "$wt" 2> /dev/null; then
    unset 'wt_paths[$wt]'
    log "removed worktree $wt${br:+ (branch $br)} at ${head:0:10}: landed, clean, unused${claim:+; its claim on $claim was stale}"
  else
    log "kept $wt: git worktree remove refused"
  fi
}
wt=""; br=""
while IFS= read -r line; do
  case "$line" in
    "worktree "*) wt="${line#worktree }"; br="" ;;
    "branch refs/heads/"*) br="${line#branch refs/heads/}" ;;
    "") [ -n "$wt" ] && tidy_worktree "$wt" "$br"; wt="" ;;
  esac
done < <(g worktree list --porcelain; echo)
g worktree prune

# --- branches ----------------------------------------------------------------------------------------------------
checked_out="$(g worktree list --porcelain | sed -n 's|^branch refs/heads/||p')"
while read -r br; do
  wanted "$br" || continue
  grep -qxF -- "$br" <<< "$checked_out" && continue
  safe "refs/heads/$br" "$br" || continue
  tip="$(g rev-parse --short=10 "refs/heads/$br")"
  g branch -q -D "$br" && log "deleted branch $br ($tip): on origin/main"
done < <(g for-each-ref --format='%(refname:short)' 'refs/heads/t[0-9]*')
while read -r rb; do
  br="${rb#origin/}"
  case "$br" in t[0-9]*) wanted "$br" || continue ;; land/*) [ -z "$only" ] || continue ;; *) continue ;; esac
  safe "refs/remotes/$rb" "$br" || continue
  tip="$(g rev-parse --short=10 "refs/remotes/$rb")"
  g push -q origin --delete "$br" 2> /dev/null && log "deleted origin branch $br ($tip): on origin/main" \
    || log "kept origin branch $br: the push refused"
done < <(g for-each-ref --format='%(refname:short)' 'refs/remotes/origin/t[0-9]*' 'refs/remotes/origin/land/*')

# --- leftover folders --------------------------------------------------------------------------------------------
[ -n "$only" ] && exit 0
for dir in "$WORKSPACE/$name"-*/; do
  dir="${dir%/}"
  [ -d "$dir" ] && [ -z "${wt_paths[$dir]:-}" ] || continue
  grep -qxF -- "$dir" <<< "$keep_list" && continue
  [ -e "$dir/.git" ] && { log "kept $dir: it has git data but is not a worktree of $name"; continue; }
  other="$(cd "$dir" && ls -A | grep -vxE 'node_modules|build|test-results|playwright-report|dist|\.vite' | head -3 | tr '\n' ' ')"
  [ -z "$other" ] || { log "kept $dir: not a worktree, but holds $other"; continue; }
  [ -n "$(find "$dir" -maxdepth 0 -mmin +1440)" ] || { log "kept $dir: newer than a day"; continue; }
  in_use "$dir" && { log "kept $dir: a running program is inside it"; continue; }
  rm -rf -- "$dir" && log "removed leftover folder $dir: not a worktree, only generated folders"
done
exit 0
