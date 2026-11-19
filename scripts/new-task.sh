#!/usr/bin/env bash
# Claim the next free task id and open its worktree: bash scripts/new-task.sh <owner> [goal] [why]
#
# Two sessions picking ids by eye collided twice on 13 Oct 2026 (T073, T079): one wrote its task
# file into the other's worktree. Here the id is claimed, not chosen. For n above the highest id
# seen in branches, worktree directories and tasks/*.yml:
#   1. git branch t<n> <base> — the claim: git creates the ref under an exclusive lock file, so of two
#      claims of one id exactly one succeeds; a branch already there means taken, try n+1
#   2. mkdir ../<repo>-t<n>   — a directory already there means taken: drop the branch just made, try n+1
# The mkdir command is not the claim: uutils coreutils mkdir (Ubuntu's default from 25.10, and the CI
# runner's) exits 0 when another process creates the directory between its own existence check and
# its mkdir call, so two claims could both "make" one directory (T854, PR 163).
# Then the worktree is added into that directory (node_modules hardlinked as new-worktree.sh does),
# tasks/T<n>.yml is written with the owner and goal and committed, and the only line on stdout is
#   T<n> <worktree path>
# Agents take the id this prints; they never type one. Any failure after the claim leaves the
# directory and branch in place (nothing is deleted once a commit exists) and exits 1.
#
# The ship remote (SHIP_REMOTE in ship.conf) must be a configured git remote: ids on its branches count too (as do
# origin's live heads). Without it the command refuses, exit 1, nothing claimed, and prints the `git remote add` to run.
#
# Env: WORKSPACE (default: the parent of the main checkout).
set -uo pipefail

OWNER="${1:?usage: new-task.sh <owner> [goal] [why]}"
GOAL="${2:-TODO: one sentence saying what is true when this task is done.}"

# shellcheck source=lib/main-checkout.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/main-checkout.sh"
src="$(main_checkout .)" || exit 2                     # the main checkout, whichever worktree we run in, in either layout
ws="${WORKSPACE:-$(dirname "$src")}"
repo="$(basename "$src")"
# The why: who asked for this and when, or the QO/BUG/F id (John, 10 Nov 2026; a pull request needs it, T767).
WHY="${3:-TODO: why this change is made: who decided and when (John, 10 Nov 2026) or the QO, BUG or F id.}"

# The ship remote (ship.conf): task branches are pushed there and its pull requests hold ids too. A clone without it
# cannot see those ids, and hands out one that is already open there (T788, portingle PR #62; QO920, John, 14 Nov 2026).
SHIP_REMOTE=""; SHIP_REPO=""
for conf in "$src/ship.conf" "$(git rev-parse --show-toplevel 2> /dev/null)/ship.conf"; do
  [ -f "$conf" ] || continue
  eval "$(. "$conf" > /dev/null 2>&1; printf 'SHIP_REMOTE=%q SHIP_REPO=%q' "${SHIP_REMOTE:-}" "${SHIP_REPO:-}")"
  [ -n "$SHIP_REMOTE" ] && break
done
if [ -z "$SHIP_REMOTE" ]; then echo "new-task: REFUSED: no SHIP_REMOTE in ship.conf, so ids on the ship remote cannot be counted; nothing claimed" >&2; exit 1; fi
if ! git -C "$src" remote | grep -qx "$SHIP_REMOTE"; then
  echo "new-task: REFUSED: git remote '$SHIP_REMOTE' (SHIP_REMOTE in ship.conf) is not configured here, so its task ids would be handed out again; nothing claimed. Add it: git remote add $SHIP_REMOTE git@github.com:${SHIP_REPO:-<owner>/<repo>}.git" >&2
  exit 1
fi

for r in origin "$SHIP_REMOTE"; do git -C "$src" fetch -q "$r" 2> /dev/null || true; done
base="origin/main"
git -C "$src" rev-parse -q --verify "$base" > /dev/null 2>&1 || base="main"

# The highest id anyone has used anywhere: branches (local and remote), worktree dirs, task files.
highest() {
  {
    git -C "$src" for-each-ref --format='%(refname:short)' refs/heads refs/remotes | sed -n 's|^.*t\([0-9][0-9]*\)$|\1|p'
    # the live heads on both remotes (also seen when the fetch above failed or the ref was never fetched)
    for r in origin "$SHIP_REMOTE"; do git -C "$src" ls-remote --heads "$r" 2> /dev/null | sed -n 's|^.*refs/heads/.*t\([0-9][0-9]*\)$|\1|p'; done
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
  git -C "$src" branch -q --no-track "$branch" "$base" 2> /dev/null || continue
  if mkdir "$dest" 2> /dev/null; then claimed="$n"; break; fi
  git -C "$src" branch -q -D "$branch"   # our own branch, made a moment ago at $base: give the id back
done
[ -n "$claimed" ] || { echo "new-task: no free id in 200 tries above $(highest)" >&2; exit 1; }

git -C "$src" worktree add -q "$dest" "$branch" || { echo "new-task: claimed $id but could not add the worktree at $dest" >&2; exit 1; }
deps="$(cd "$src" && ls -d node_modules packages/*/node_modules 2> /dev/null || true)"
for dir in $deps; do
  mkdir -p "$dest/$(dirname "$dir")"
  cp -al "$src/$dir" "$dest/$dir"
done

# Free text goes in as a single-quoted YAML scalar (' doubled, newlines folded to spaces), so ': ', '#', a leading
# quote or '-' and words like true cannot break the file (T931: T923, T925, T927, T928 were hand-fixed).
yq() { printf "'%s'" "$(printf '%s' "$1" | tr '\n' ' ' | sed "s/'/''/g")"; }
cat > "$dest/tasks/$id.yml" <<YAML
id: $id
release_note: internal
repo: $repo
owner: $OWNER
status: open
goal: $(yq "$GOAL")
why: $(yq "$WHY")
done_test: bash scripts/quiet-test.sh npm run typecheck
files:
  - tasks/$id.yml
YAML
if ! { git -C "$dest" add "tasks/$id.yml" && git -C "$dest" commit -q -m "(auto) $id: task file"; }; then
  echo "new-task: claimed $id at $dest but the task file did not commit" >&2; exit 1
fi
echo "$id $dest"
