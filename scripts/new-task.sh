#!/usr/bin/env bash
# Claim the next free task id and open its worktree: bash scripts/new-task.sh <owner> [goal]
#
# Two sessions picking ids by eye collided twice on 13 Oct 2026 (T073, T079): one wrote its task
# file into the other's worktree. Here the id is claimed, not chosen. For n above the highest id
# seen in branches, worktree directories and tasks/*.yml:
#   1. mkdir ../<repo>-t<n>   — atomic; a directory already there means taken, try n+1
#   2. git branch t<n> <base> — atomic; a branch already there means taken, undo the mkdir, try n+1
# Then the worktree is added into that directory (node_modules hardlinked as new-worktree.sh does),
# tasks/T<n>.yml is written with the owner and goal and committed, and the only line on stdout is
#   T<n> <worktree path>
# Agents take the id this prints; they never type one. Any failure after the claim leaves the
# directory and branch in place (nothing is deleted once a commit exists) and exits 1.
#
# Env: WORKSPACE (default: the parent of the main checkout).
set -uo pipefail

OWNER="${1:?usage: new-task.sh <owner> [goal]}"
GOAL="${2:-TODO: one sentence saying what is true when this task is done.}"

common="$(git rev-parse --git-common-dir)" || exit 2
src="$(cd "$(dirname "$common")" && pwd)"            # the main checkout, whichever worktree we run in
ws="${WORKSPACE:-$(dirname "$src")}"
repo="$(basename "$src")"

git -C "$src" fetch -q origin 2> /dev/null || true
base="origin/main"
git -C "$src" rev-parse -q --verify "$base" > /dev/null 2>&1 || base="main"

# The highest id anyone has used anywhere: branches (local and remote), worktree dirs, task files.
highest() {
  {
    git -C "$src" for-each-ref --format='%(refname:short)' refs/heads refs/remotes | sed -n 's|^.*t\([0-9][0-9]*\)$|\1|p'
    find "$ws" -maxdepth 1 -name "$repo-t[0-9]*" 2> /dev/null | sed -n 's|.*-t\([0-9][0-9]*\)$|\1|p'
    find "$src/tasks" -maxdepth 1 -name 'T[0-9]*.yml' 2> /dev/null | sed -n 's|.*/T\([0-9][0-9]*\)\.yml$|\1|p'
    git -C "$src" ls-tree --name-only "$base" tasks/ 2> /dev/null | sed -n 's|^tasks/T\([0-9][0-9]*\)\.yml$|\1|p'
  } | sort -n | tail -n 1
}

n="$(highest)"; n=$((10#${n:-0}))
claimed=""
for _ in $(seq 1 200); do
  n=$((n + 1))
  id="$(printf 'T%03d' "$n")"; branch="$(printf 't%03d' "$n")"; dest="$ws/$repo-$branch"
  mkdir "$dest" 2> /dev/null || continue
  if git -C "$src" branch -q --no-track "$branch" "$base" 2> /dev/null; then claimed="$n"; break; fi
  rmdir "$dest"
done
[ -n "$claimed" ] || { echo "new-task: no free id in 200 tries above $(highest)" >&2; exit 1; }

git -C "$src" worktree add -q "$dest" "$branch" || { echo "new-task: claimed $id but could not add the worktree at $dest" >&2; exit 1; }
deps="$(cd "$src" && ls -d node_modules packages/*/node_modules 2> /dev/null || true)"
for dir in $deps; do
  mkdir -p "$dest/$(dirname "$dir")"
  cp -al "$src/$dir" "$dest/$dir"
done

cat > "$dest/tasks/$id.yml" <<YAML
id: $id
release_note: internal
repo: $repo
owner: $OWNER
status: open
goal: $GOAL
done_test: bash scripts/quiet-test.sh npm run typecheck
files:
  - tasks/$id.yml
YAML
if ! { git -C "$dest" add "tasks/$id.yml" && git -C "$dest" commit -q -m "(auto) $id: task file"; }; then
  echo "new-task: claimed $id at $dest but the task file did not commit" >&2; exit 1
fi
echo "$id $dest"
