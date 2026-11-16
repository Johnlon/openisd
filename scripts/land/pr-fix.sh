#!/usr/bin/env bash
# One command to fix a red pull request (T815, John 15 Nov 2026): a fresh worktree from the pushed branch.
#
#   bash scripts/land/pr-fix.sh T<n>      from any worktree or the main checkout; prints the worktree path
#
# ship.sh removes the task's worktree at once (docs/DEV_PROCESS.md: a red pull request is fixed in a fresh worktree from
# the branch). This makes that worktree: branch t<n> at $SHIP_REMOTE's tip, node_modules hardlinked as new-task.sh does,
# the task file as pushed (status done; no claim, so no .task file). Edit, then `bash scripts/ship.sh T<n>` again: it reuses the pull request and re-confirms the queue.
# Refuses (exit 1) when the remote has no such branch, or the branch or folder already exists locally.
set -uo pipefail
ID="${1:?usage: pr-fix.sh T<n>}"
[[ "$ID" =~ ^T[0-9]+$ ]] || { echo "pr-fix: '$ID' is not a task id like T815" >&2; exit 2; }
branch="$(printf '%s' "$ID" | tr 'T' 't')"
common="$(git rev-parse --git-common-dir)" || exit 2
src="$(cd "$(dirname "$common")" && pwd)"
SHIP_REMOTE=""; [ -f "$src/ship.conf" ] && . "$src/ship.conf"
: "${SHIP_REMOTE:?pr-fix: SHIP_REMOTE is not set in ship.conf}"
dest="$(dirname "$src")/$(basename "$src")-$branch"
git -C "$src" fetch -q "$SHIP_REMOTE" "refs/heads/$branch:refs/remotes/$SHIP_REMOTE/$branch" 2> /dev/null \
  || { echo "pr-fix: REFUSED: $SHIP_REMOTE has no branch $branch for $ID (or the fetch failed); nothing made" >&2; exit 1; }
git -C "$src" rev-parse -q --verify "refs/heads/$branch" > /dev/null \
  && { echo "pr-fix: REFUSED: local branch $branch already exists (a worktree of it may be live); nothing made" >&2; exit 1; }
[ ! -e "$dest" ] || { echo "pr-fix: REFUSED: $dest already exists; nothing made" >&2; exit 1; }
git -C "$src" worktree add -q -b "$branch" "$dest" "$SHIP_REMOTE/$branch" || { echo "pr-fix: could not add the worktree at $dest" >&2; exit 1; }
for dir in $(cd "$src" && ls -d node_modules packages/*/node_modules 2> /dev/null || true); do
  mkdir -p "$dest/$(dirname "$dir")"; cp -al "$src/$dir" "$dest/$dir"
done
echo "$dest"
