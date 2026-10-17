#!/usr/bin/env bash
# Removes the task branches, worktrees and folders whose work is safe elsewhere (T334, John 17 Oct 2026: "I don't
# want dead branches and worktrees lying around"). The watchdog runs it every tick; abandon.sh runs it for the
# task it abandons. Nothing is ever removed that holds work found nowhere else:
#   - a worktree beside the main folder (<workspace>/<repo>-*) goes when it is clean (no modified or untracked
#     file), no running program has its folder inside it, and its HEAD is on origin/main, or its task is
#     abandoned and HEAD is in the task's archived commits. A claim (.task) left in it is logged as stale.
#     The main folder and the synced copies (git config openisd.mainFolder / openisd.syncedCopy) are never touched;
#   - a task branch (t<n>), local or on origin, goes when it is checked out nowhere and every commit on it is on
#     origin/main, or in its abandoned task's archive (refs/archive/T<n>). A land/<task> candidate branch on origin
#     goes when it is on origin/main;
#   - a folder <workspace>/<repo>-* that is not a worktree and has no git data goes when it holds only generated
#     folders (node_modules, build, test-results, playwright-report, dist, .vite).
# An abandoned task's worktree with uncommitted work is kept and reported on stdout as "held: <text>" (the watchdog
# makes it an agent alert). Every removal and every kept item with a reason is logged with a UTC timestamp.
#
#   bash scripts/land/tidy-branches.sh [--only T<n>] [<any checkout of the repo>]
#
# An abandoned task is one whose tasks/T<n>.yml on origin/main says `status: abandoned` and `archived: <sha>`
# (written by scripts/abandon.sh). Env: TIDY_LOG (default <main>/build/test-logs/tidy-branches.log), WORKSPACE
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
mkdir -p "$(dirname "$LOG")"
log() { printf '%s tidy-branches: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" | tee -a "$LOG"; }
g() { git -C "$main" "$@"; }

exec 8> "$common/tidy-branches.lock" || { log "cannot open $common/tidy-branches.lock"; exit 1; }
flock -n 8 || { echo "tidy-branches: another run is tidying"; exit 0; }
timeout 120 git -C "$main" fetch -q --prune origin || { log "cannot fetch origin; nothing removed"; exit 1; }
g rev-parse -q --verify origin/main > /dev/null || { log "no origin/main; nothing removed"; exit 1; }

# archived <branch>: the archived sha of the abandoned task this task branch (t<n>) belongs to, or nothing.
archived() {
  local id f
  case "$1" in t[0-9]*) id="T${1#t}" ;; *) return 0 ;; esac
  f="$(g show "origin/main:tasks/$id.yml" 2> /dev/null)" || return 0
  grep -qx 'status: abandoned' <<< "$f" || return 0
  sed -n 's/^archived: *//p' <<< "$f" | head -n 1
}
# safe <commit> <branch>: every commit is on origin/main, or in the abandoned task's archive.
safe() {
  local arch
  g merge-base --is-ancestor "$1" origin/main 2> /dev/null && return 0
  arch="$(archived "$2")"
  [ -n "$arch" ] && [ "$(g rev-parse -q --verify "refs/archive/T${2#t}")" = "$(g rev-parse -q --verify "$arch")" ] \
    && g merge-base --is-ancestor "$1" "$arch" 2> /dev/null
}
wanted() { [ -z "$only" ] || [ "$1" = "t${only#T}" ]; }
in_use() { # in_use <dir>: a running program's current folder is inside it
  local p cwd
  for p in /proc/[0-9]*; do
    cwd="$(readlink "$p/cwd" 2> /dev/null)" || continue
    case "$cwd/" in "$1"/*) return 0 ;; esac
  done
  return 1
}
keep_list="$( { g config --get openisd.mainFolder; g config --get-all openisd.syncedCopy; echo "$main"; } 2> /dev/null)"

# --- worktrees ---------------------------------------------------------------------------------------------------
declare -A wt_paths=()
tidy_worktree() { # tidy_worktree <path> <branch or empty>
  local wt="$1" br="$2" head claim
  wt_paths["$wt"]=1
  grep -qxF -- "$wt" <<< "$keep_list" && return 0
  case "$wt" in "$WORKSPACE/$name"-*) ;; *) return 0 ;; esac
  wanted "$br" || return 0
  head="$(git -C "$wt" rev-parse HEAD 2> /dev/null)" || { log "kept $wt: cannot read HEAD"; return 0; }
  safe "$head" "$br" || return 0
  if [ -n "$(git -C "$wt" status --porcelain --untracked-files=all 2> /dev/null)" ]; then
    log "kept $wt: uncommitted work"
    [ -n "$(archived "$br")" ] && echo "held: abandoned task ${br/t/T}'s worktree $wt has uncommitted work; commit it, then it is removed"
    return 0
  fi
  in_use "$wt" && { log "kept $wt: a running program is inside it"; return 0; }
  claim="$(cat "$wt/.task" 2> /dev/null)"
  if g worktree remove "$wt" 2> /dev/null; then
    unset 'wt_paths[$wt]'
    log "removed worktree $wt${br:+ (branch $br)}: $( [ -n "$(archived "$br")" ] && echo abandoned || echo landed ), clean, unused${claim:+; its claim on $claim was stale}"
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
  g branch -q -D "$br" && log "deleted branch $br: $( [ -n "$(archived "$br")" ] && echo "abandoned, kept as refs/archive/T${br#t}" || echo "on origin/main" )"
done < <(g for-each-ref --format='%(refname:short)' 'refs/heads/t[0-9]*')
while read -r rb; do
  br="${rb#origin/}"
  case "$br" in t[0-9]*) wanted "$br" || continue ;; land/*) [ -z "$only" ] || continue ;; *) continue ;; esac
  safe "refs/remotes/$rb" "$br" || continue
  g push -q origin --delete "$br" 2> /dev/null && log "deleted origin branch $br: $( [ -n "$(archived "$br")" ] && echo abandoned || echo "on origin/main" )" \
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
  in_use "$dir" && { log "kept $dir: a running program is inside it"; continue; }
  rm -rf -- "$dir" && log "removed leftover folder $dir: not a worktree, only generated folders"
done
exit 0
