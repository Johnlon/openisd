#!/usr/bin/env bash
# Has CI's test machine draw the baseline pictures for the commit checked out here, and takes the result (T799).
#   bash scripts/visual/retake-ci.sh        (scripts/visual/update.sh calls it)
# Pushes HEAD to a throwaway branch visual-retake/<branch>-<sha>; that push runs .github/workflows/visual-retake.yml,
# which draws every screen in the suite's test machine, draws them again to prove the drawing is stable, and uploads
# the pictures that differ from the committed ones (each stamped with the run id) with the UI sources' hash. This
# waits for it, copies the pictures over the committed ones, writes SOURCES.sha256, and deletes the throwaway branch.
# Needs: a clean tree (commit first), network, and gh logged in. Takes minutes.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
# shellcheck source=./lib.sh
. scripts/visual/lib.sh
[ -f ship.conf ] && . ./ship.conf
REMOTE="${SHIP_REMOTE:-portingle}"; REPO="${VISUAL_REPO:-${SHIP_REPO:-portingle/openisd}}"
GH="${VISUAL_GH:-${LAND_GH:-gh}}"
[ -z "$(git status --porcelain)" ] || { echo "retake-ci: uncommitted work here; CI draws the commit, so commit everything first" >&2; exit 1; }
sha="$(git rev-parse HEAD)"; branch="visual-retake/$(git rev-parse --abbrev-ref HEAD | tr -c 'A-Za-z0-9._\n-' '-')-${sha:0:8}"
work="$(mktemp -d)"; trap 'rm -rf "$work"; git push -q "$REMOTE" --delete "$branch" 2> /dev/null || true' EXIT
git push -q "$REMOTE" "HEAD:refs/heads/$branch"
echo "retake-ci: pushed $branch; waiting for CI to draw ${sha:0:10}"
# GitHub has no call that waits for a run to exist, so find it with a bounded retry; the wait for the run itself blocks (gh run watch).
run=""
for _ in $(seq 1 30); do
  run="$("$GH" run list -R "$REPO" --workflow visual-retake.yml --branch "$branch" --json databaseId,headSha --jq ".[] | select(.headSha == \"$sha\") | .databaseId" | head -n 1)"
  [ -z "$run" ] || break
  sleep 4
done
[ -n "$run" ] || { echo "retake-ci: no visual-retake run started for $branch" >&2; exit 1; }
echo "retake-ci: run $run: https://github.com/$REPO/actions/runs/$run"
"$GH" run watch "$run" -R "$REPO" --exit-status > /dev/null || { echo "retake-ci: run $run failed; its log and the failures artifact say which screen drew unstably" >&2; exit 1; }
"$GH" run download "$run" -R "$REPO" -n visual-baselines -D "$work/r"
[ "$(cat "$work/r/SOURCES.sha256")" = "$(visual_sources_hash)" ] || { echo "retake-ci: CI drew from other sources than these (the UI sources hash differs); nothing taken" >&2; exit 1; }
( cd "$work/r/pictures" && { [ -z "$(ls -A .)" ] || sha256sum -c --quiet "$work/r/MANIFEST.sha256"; } ) || { echo "retake-ci: a downloaded picture does not match the run's manifest; nothing taken" >&2; exit 1; }
mkdir -p "$VISUAL_SNAPSHOT_DIR"; cp -f "$work"/r/pictures/*.png "$VISUAL_SNAPSHOT_DIR/" 2> /dev/null || true
cp "$work/r/SOURCES.sha256" "$VISUAL_SOURCES_HASH_FILE"
git status --short -- packages/ui/test/visual | sed -n 's#^.. .*/\([^/]*\)\.png$#visual: changed \1#p'
echo "retake-ci: done (run $run); list the changed screens under visual: and commit"
