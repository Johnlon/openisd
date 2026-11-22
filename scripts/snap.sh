#!/usr/bin/env bash
# Builds a snapshot of the current HEAD (main, in CI) and publishes it as a GitHub pre-release.
#   bash scripts/snap.sh   build one now: every push to main, and on demand (workflow_dispatch)
# Stamp = scripts/version-info.mjs at minute resolution. Builds with the relative base './', zips
# dist as openisd-<stamp>.zip, tags HEAD snap-<stamp>, creates the pre-release "Snapshot <stamp>"
# with notes since the last release, then prunes to the newest 10. Writes built=true|false to
# $GITHUB_OUTPUT so the workflow deploys only after a build.
# Test seams: SNAP_BUILD_CMD (default scripts/build-release.sh), SNAP_DIST (default
# packages/ui/dist), OPENISD_NOW (clock for the stamp).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

BUILD_CMD="${SNAP_BUILD_CMD:-bash scripts/build-release.sh}"
DIST="${SNAP_DIST:-packages/ui/dist}"
built() { if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "built=$1" >> "$GITHUB_OUTPUT"; fi; }
refuse() { echo "snap: $*" >&2; built false; exit 1; }

[ $# = 0 ] || { echo "usage: snap.sh" >&2; exit 2; }

git diff --quiet HEAD -- || refuse "tracked files have uncommitted changes; a snapshot is a commit"
STAMP="$(GITHUB_REF= node scripts/version-info.mjs --stamp)"
TAG="snap-$STAMP"
if [ -n "$(git ls-remote --tags origin "refs/tags/$TAG")" ]; then refuse "$TAG already exists on the remote"; fi

SHA="$(git rev-parse HEAD)"
git fetch --quiet --tags origin
LAST_RELEASE="$(gh release list --exclude-pre-releases --limit 1 --json tagName --jq '.[0].tagName // empty')"

NOTES="$(mktemp "${TMPDIR:-/tmp}/snap-notes.XXXXXX")"
trap 'rm -f "$NOTES"' EXIT
# The notes cover what changed since the last release, else since the newest snapshot, else the
# last 30 commits. scripts/hosting/releaseNotes.mjs writes plain sentences: no hashes, no ids.
if [ -n "$LAST_RELEASE" ] && git rev-parse -q --verify "refs/tags/$LAST_RELEASE^{commit}" > /dev/null; then
  FROM="refs/tags/$LAST_RELEASE"
else
  PREV_SNAP="$(git tag -l 'snap-*' --sort=-refname | head -1)"
  FROM="${PREV_SNAP:+refs/tags/$PREV_SNAP}"
fi
node scripts/hosting/releaseNotes.mjs notes "${FROM:-}" "$SHA" > "$NOTES"

GITHUB_REF="refs/tags/$TAG" OPENISD_RELATIVE_BASE=1 bash -c "$BUILD_CMD"
[ -f "$DIST/index.html" ] || refuse "the build left no $DIST/index.html"

ZIP="$PWD/build/snap/openisd-$STAMP.zip"
mkdir -p "$(dirname "$ZIP")"; rm -f "$ZIP"
if command -v zip > /dev/null; then (cd "$DIST" && zip -qr "$ZIP" .); else (cd "$DIST" && python3 -m zipfile -c "$ZIP" .); fi

git tag "$TAG" "$SHA"
git push --quiet origin "refs/tags/$TAG"
gh release create "$TAG" "$ZIP" --prerelease --verify-tag --title "Snapshot $STAMP" --notes-file "$NOTES"
echo "snap: published $TAG"
bash scripts/snap-prune.sh
built true
