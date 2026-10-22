#!/usr/bin/env bash
# Promotes a tested snapshot build to a release. Builds nothing, downloads nothing: same bytes.
#   bash scripts/release.sh --public <n.n.n> <stamp>   e.g. --public 7.0.952 20260101T0102Z
#   bash scripts/release.sh --latest <stamp>   mark an existing release Latest (rollback)
#   bash scripts/release.sh --notes-file F <stamp>   promote with notes from F; without it the
#                                                    snapshot's own notes are kept
# --public is the release's public number (OpenISD 7.0.951, 7.0.952, ...): required to promote, and it
# must be greater than the highest number already in a release title. It goes in the release title
# "OpenISD <n.n.n>" and in RELEASES.md.
# Promote refuses unless snap-<stamp> exists and no F is open (tasks/fixes/*.yml, status: open).
# It runs scripts/hosting/test/hosted-copies.e2e.mjs; a failure refuses.
# It runs the UI gallery (scripts/ui-gallery/capture.mjs), snapshot after and current Latest before;
# a failed capture refuses.
# It then adds tag v<stamp> on the same commit (the snap- tag stays), turns the pre-release into a
# release marked Latest, and moves the read-only branch `release` to it by fast-forward (a merge keeps hotfix commits that
# are only on `release`). The move is worked out and dry-run checked before anything is published.
# Editing the release triggers .github/workflows/release.yml (the tag push does not), which
# redeploys the site.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

STAMP_RE='^[0-9]{8}T[0-9]{4}Z$'
refuse() { echo "release: $*" >&2; exit 1; }

LATEST_ONLY=0
NOTES_FILE=''
PUBLIC=''
while [ $# -gt 0 ]; do
  case "$1" in
    --latest) LATEST_ONLY=1; shift ;;
    --notes-file) NOTES_FILE="${2:-}"; [ -f "$NOTES_FILE" ] || refuse "no notes file '$NOTES_FILE'"; shift 2 ;;
    --public) PUBLIC="${2:-}"; shift 2 ;;
    *) break ;;
  esac
done
STAMP="${1:-}"
[[ "$STAMP" =~ $STAMP_RE ]] || { echo "usage: release.sh --public <n.n.n> [--notes-file F] <stamp> | release.sh --latest <stamp>   (stamp like 20260101T0102Z)" >&2; exit 2; }
SNAP="snap-$STAMP"
REL="v$STAMP"

if [ "$LATEST_ONLY" = 1 ]; then
  pre="$(gh release view "$REL" --json isPrerelease --jq .isPrerelease 2> /dev/null)" || refuse "no release $REL"
  [ "$pre" = false ] || refuse "$REL is a pre-release, not a release; promote it first"
  gh release edit "$REL" --latest
  echo "release: $REL is now Latest"
  exit 0
fi

PUBLIC_RE='^[0-9]+\.[0-9]+\.[0-9]+$'
[[ "$PUBLIC" =~ $PUBLIC_RE ]] || { echo "release: --public <n.n.n> is required (like 7.0.952)" >&2; exit 2; }
# The highest number any release title carries; a new number must beat it.
LAST_PUBLIC="$(gh release list --exclude-pre-releases --limit 200 --json name --jq '.[].name' | sed -n 's/^OpenISD \([0-9]*\.[0-9]*\.[0-9]*\)$/\1/p' | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)"
if [ -n "$LAST_PUBLIC" ] && [ "$(printf '%s\n%s\n' "$LAST_PUBLIC" "$PUBLIC" | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)" != "$PUBLIC" -o "$LAST_PUBLIC" = "$PUBLIC" ]; then
  refuse "public number $PUBLIC is not greater than the last, $LAST_PUBLIC"
fi
[ -n "$(git ls-remote --tags origin "refs/tags/$SNAP")" ] || refuse "no snapshot $SNAP on the remote"
[ -z "$(git ls-remote --tags origin "refs/tags/$REL")" ] || refuse "$REL already exists; use --latest $STAMP to make it Latest"

open_fixes="$(grep -lE '^status:[[:space:]]*open[[:space:]]*$' tasks/fixes/*.yml 2> /dev/null || true)"
[ -z "$open_fixes" ] || refuse "an F is open, fix it first: $(echo "$open_fixes" | xargs -n1 basename | tr '\n' ' ')"

git fetch --quiet origin "refs/tags/$SNAP:refs/tags/$SNAP"
SHA="$(git rev-parse "refs/tags/$SNAP^{commit}")"

# Every release starts in a browser that already runs the live build (T396). A failure stops it.
node scripts/hosting/test/hosted-copies.e2e.mjs || refuse "hosted copies end-to-end test failed"

# Every release has a UI gallery run: this snapshot against the current Latest, kept under
# ../ui-gallery/ as the release's before/after record. A failed capture stops the release.
LATEST_TAG="$(gh release view --json tagName --jq .tagName 2> /dev/null || true)"
BEFORE=none
[ -z "$LATEST_TAG" ] || BEFORE="https://snapshots.openisd.app/v/${LATEST_TAG#v}/"
node scripts/ui-gallery/capture.mjs --after "https://snapshots.openisd.app/snap/$STAMP/" --before "$BEFORE" || refuse "UI gallery capture failed"

# The read-only `release` branch only ever moves forward, and git must accept the move. Work out the
# move and check the remote will take it BEFORE any outward step (tag push, gh release edit), so a
# rejected push can never leave a live release with `release` not moved. The push itself comes right
# after the publish step. Never a force-push.
#   release already contains $SHA             -> nothing (an older snapshot leaves the branch alone)
#   release is an ancestor of $SHA            -> push $SHA (fast-forward)
#   otherwise (a hotfix sits only on release) -> push a merge commit: tree of $SHA, parents the old
#                                                release tip and $SHA, so the tree is exactly the
#                                                promoted build and the hotfix history is kept
git fetch --quiet origin "refs/heads/release:refs/remotes/origin/release" 2> /dev/null || true
RELEASE_PUSH=''
if ! git rev-parse -q --verify refs/remotes/origin/release > /dev/null; then
  RELEASE_PUSH="$SHA"
else
  RELEASE_TIP="$(git rev-parse refs/remotes/origin/release)"
  if git merge-base --is-ancestor "$SHA" "$RELEASE_TIP"; then
    echo "release: branch release already contains $SHA"
  elif git merge-base --is-ancestor "$RELEASE_TIP" "$SHA"; then
    RELEASE_PUSH="$SHA"
  else
    RELEASE_PUSH="$(git commit-tree "$SHA^{tree}" -p "$RELEASE_TIP" -p "$SHA" -m "Release $PUBLIC: $STAMP onto release (keeps hotfix history)")"
    echo "release: branch release holds commits not in $SHA; moving it with merge $RELEASE_PUSH"
  fi
fi
if [ -n "$RELEASE_PUSH" ]; then
  git push --quiet --dry-run origin "$RELEASE_PUSH:refs/heads/release" || refuse "the release branch would reject the move; nothing was published"
fi

git tag "$REL" "$SHA"
git push --quiet origin "refs/tags/$REL"
NOTES_ARGS=()
[ -z "$NOTES_FILE" ] || NOTES_ARGS=(--notes-file "$NOTES_FILE")
gh release edit "$SNAP" --tag "$REL" --title "OpenISD $PUBLIC" --prerelease=false --latest ${NOTES_ARGS[@]+"${NOTES_ARGS[@]}"}

[ -z "$RELEASE_PUSH" ] || git push --quiet origin "$RELEASE_PUSH:refs/heads/release"

# RELEASES.md: one row per release, newest first. Left in the working tree for the caller to commit.
DATE="$(date -u -d "${STAMP:0:8} ${STAMP:9:2}:${STAMP:11:2}" '+%-d %b %Y, %H:%M')"
if [ -n "$NOTES_FILE" ]; then NOTE_TEXT="$(cat "$NOTES_FILE")"; else NOTE_TEXT="$(gh release view "$REL" --json body --jq .body)"; fi
SUBJECT="$(printf '%s\n' "$NOTE_TEXT" | node scripts/hosting/releaseNotes.mjs headline | tr '|' '/')"
ROW="| $PUBLIC | $STAMP | $DATE | \`${SHA:0:9}\` | [v/$STAMP](https://snapshots.openisd.app/v/$STAMP/) | [GitHub](https://github.com/Johnlon/openisd/releases/tag/$REL) | $SUBJECT |"
if [ ! -f RELEASES.md ]; then
  printf '# Releases\n\nNewest first. `scripts/release.sh` adds a row when it promotes a snapshot. Dates are UTC.\n\n| Version | Stamp | Date | Commit | Hosted | GitHub | Notes |\n|---|---|---|---|---|---|---|\n' > RELEASES.md
fi
awk -v row="$ROW" '{print} /^\|---/ && !done {print row; done=1}' RELEASES.md > RELEASES.md.new && mv RELEASES.md.new RELEASES.md
echo "release: $REL is Latest at $SHA; RELEASES.md updated, commit it"
