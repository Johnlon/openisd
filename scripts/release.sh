#!/usr/bin/env bash
# Promotes a tested snapshot build to a release. Builds nothing, downloads nothing: same bytes.
#   bash scripts/release.sh --public <n.n.n> <stamp>   e.g. --public 7.0.952 20260101T0102Z
#   bash scripts/release.sh --prepare --public <n.n.n> [--notes-file F] <stamp>
#   bash scripts/release.sh --approve-prepared <manifest>
#   bash scripts/release.sh --latest <stamp>   mark an existing release Latest (rollback)
#   bash scripts/release.sh --notes-file F <stamp>   promote with notes from F; without it the
#                                                    snapshot's own notes are kept
# --public is the release's public number (OpenISD 7.0.951, 7.0.952, ...): required to promote, and it
# must be greater than the highest number already in a release title. It goes in the release title
# "OpenISD <n.n.n>" and in RELEASES.md.
# --prepare runs every slow release check and writes a 7-day readiness record without publishing.
# --approve-prepared revalidates that exact snapshot, production, test, main and release branch state,
# then publishes without repeating browser checks. The approval command itself is the approval.
# The ordinary --public path still runs the checks and publishes in one command.
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
MODE=publish
APPROVAL_MANIFEST=''
NOTES_FILE=''
PUBLIC=''
while [ $# -gt 0 ]; do
  case "$1" in
    --latest) LATEST_ONLY=1; shift ;;
    --prepare) [ "$MODE" = publish ] || refuse "choose one release mode"; MODE=prepare; shift ;;
    --approve-prepared)
      [ "$MODE" = publish ] && [ "$#" -ge 2 ] || refuse "usage: release.sh --approve-prepared <manifest>"
      MODE=approve; APPROVAL_MANIFEST="$2"; shift 2 ;;
    --notes-file) NOTES_FILE="${2:-}"; [ -f "$NOTES_FILE" ] || refuse "no notes file '$NOTES_FILE'"; shift 2 ;;
    --public) PUBLIC="${2:-}"; shift 2 ;;
    *) break ;;
  esac
done
if [ "$MODE" = approve ]; then
  [ "$LATEST_ONLY" = 0 ] && [ -z "$PUBLIC" ] && [ -z "$NOTES_FILE" ] && [ "$#" = 0 ] \
    && [ -n "$APPROVAL_MANIFEST" ] && [ -f "$APPROVAL_MANIFEST" ] \
    || refuse "usage: release.sh --approve-prepared <manifest>"
  APPROVAL_MANIFEST="$(realpath "$APPROVAL_MANIFEST")"
  node - "$APPROVAL_MANIFEST" <<'NODE' || refuse "invalid release-readiness record"
const fs = require('node:fs');
const m = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (m.version !== 1 || m.checks?.hostedCopies !== 'passed' || m.checks?.uiGallery !== 'passed'
    || typeof m.public !== 'string' || !/^\d+\.\d+\.\d+$/.test(m.public)
    || typeof m.stamp !== 'string' || !/^\d{8}T\d{4}Z$/.test(m.stamp)
    || !/^[0-9a-f]{40}$/.test(m.snapshotSha) || !/^[0-9a-f]{40}$/.test(m.mainSha)
    || typeof m.latestTag !== 'string' || typeof m.releaseTip !== 'string' || typeof m.releasePush !== 'string'
    || typeof m.notesFile !== 'string' || typeof m.notesSha256 !== 'string'
    || typeof m.testVersion !== 'string' || typeof m.productionVersion !== 'string'
    || !Number.isSafeInteger(m.preparedAt) || !Number.isSafeInteger(m.expiresAt)
    || m.expiresAt <= m.preparedAt || m.expiresAt > m.preparedAt + 7 * 24 * 60 * 60) process.exit(1);
NODE
  manifest_value() { node -e 'const m=require(process.argv[1]); const v=m[process.argv[2]]; if(v==null) process.exit(1); process.stdout.write(String(v));' "$APPROVAL_MANIFEST" "$1"; }
  PUBLIC="$(manifest_value public)"
  STAMP="$(manifest_value stamp)"
  NOTES_FILE="$(manifest_value notesFile)"
  PREPARED_SNAPSHOT_SHA="$(manifest_value snapshotSha)"
  PREPARED_MAIN_SHA="$(manifest_value mainSha)"
  PREPARED_LATEST_TAG="$(manifest_value latestTag)"
  PREPARED_RELEASE_TIP="$(manifest_value releaseTip)"
  PREPARED_RELEASE_PUSH="$(manifest_value releasePush)"
  PREPARED_NOTES_SHA="$(manifest_value notesSha256)"
  PREPARED_TEST_VERSION="$(manifest_value testVersion)"
  PREPARED_PROD_VERSION="$(manifest_value productionVersion)"
  PREPARED_AT="$(manifest_value preparedAt)"
  EXPIRES_AT="$(manifest_value expiresAt)"
else
  STAMP="${1:-}"
  [ "$#" -eq 0 ] || shift
  [ "$#" = 0 ] || refuse "unexpected argument after the build stamp"
fi
[[ "${STAMP:-}" =~ $STAMP_RE ]] || { echo "usage: release.sh --public <n.n.n> [--notes-file F] <stamp> | --prepare --public <n.n.n> [--notes-file F] <stamp> | --approve-prepared <manifest> | --latest <stamp>" >&2; exit 2; }
[ "$LATEST_ONLY" = 0 ] || [ "$MODE" = publish ] || refuse "--latest cannot be combined with preflight modes"
SNAP="snap-$STAMP"
REL="v$STAMP"

dispatch_production_deploy() {
  local release_tag="$1"
  # Pages only permits the main branch in its deployment environment. The caller already has
  # authenticated gh access to promote this release; dispatch from that allowed branch and have
  # deploy.yml verify that the public build ID is this release before it reports success.
  gh workflow run deploy.yml --ref main --field publish_production=true --field expected_build_id="$release_tag"
  echo "release: production deploy dispatched from main for $release_tag"
}

if [ "$LATEST_ONLY" = 1 ]; then
  pre="$(gh release view "$REL" --json isPrerelease --jq .isPrerelease 2> /dev/null)" || refuse "no release $REL"
  [ "$pre" = false ] || refuse "$REL is a pre-release, not a release; promote it first"
  gh release edit "$REL" --latest
  dispatch_production_deploy "$REL"
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
LATEST_TAG="$(gh release view --json tagName --jq .tagName 2> /dev/null || true)"
MAIN_SHA="$(git ls-remote origin refs/heads/main | awk '{print $1}')"
[ -n "$MAIN_SHA" ] || refuse "cannot read origin/main"
RELEASE_TIP="$(git ls-remote origin refs/heads/release | awk '{print $1}')"

if [ "$MODE" != publish ]; then
  [ "$SHA" = "$MAIN_SHA" ] || refuse "$SNAP is not the current main build; create a snapshot of current main first"
  TEST_VERSION="$(curl -fsS https://test.openisd.app/build-info.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).version||"")}catch{process.exit(1)}})')" \
    || refuse "cannot read the test build ID"
  [ "$TEST_VERSION" = "v$STAMP" ] || refuse "test.openisd.app is $TEST_VERSION, expected v$STAMP"
  PRODUCTION_VERSION="$(curl -fsS https://openisd.app/build-info.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).version||"")}catch{process.exit(1)}})')" \
    || refuse "cannot read the production build ID"
  [ -n "$LATEST_TAG" ] && [ "$PRODUCTION_VERSION" = "$LATEST_TAG" ] \
    || refuse "production is $PRODUCTION_VERSION, while GitHub Latest is ${LATEST_TAG:-none}"
fi

# The read-only `release` branch only ever moves forward, and git must accept the move. Work out the
# move and check the remote will take it BEFORE any outward step (tag push, gh release edit), so a
# rejected push can never leave a live release with `release` not moved. The push itself comes right
# after the publish step. Never a force-push.
#   release already contains $SHA             -> nothing (an older snapshot leaves the branch alone)
#   release is an ancestor of $SHA            -> push $SHA (fast-forward)
#   otherwise (a hotfix sits only on release) -> push a merge commit: tree of $SHA, parents the old
#                                                release tip and $SHA, so the tree is exactly the
#                                                promoted build and the hotfix history is kept
RELEASE_PUSH=''
if [ -n "$RELEASE_TIP" ]; then
  git fetch --quiet origin "refs/heads/release:refs/remotes/origin/release" || refuse "cannot fetch origin/release"
  [ "$(git rev-parse refs/remotes/origin/release)" = "$RELEASE_TIP" ] || refuse "release branch changed while preparing"
fi
if [ -z "$RELEASE_TIP" ]; then
  RELEASE_PUSH="$SHA"
else
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

if [ "$MODE" = approve ]; then
  NOW="$(date -u +%s)"
  [ "$NOW" -le "$EXPIRES_AT" ] || refuse "readiness record expired; prepare again"
  [ "$SHA" = "$PREPARED_SNAPSHOT_SHA" ] || refuse "snapshot changed since preparation"
  [ "$MAIN_SHA" = "$PREPARED_MAIN_SHA" ] || refuse "main changed since preparation; prepare again"
  [ "$LATEST_TAG" = "$PREPARED_LATEST_TAG" ] || refuse "Latest release changed since preparation"
  [ "$RELEASE_TIP" = "$PREPARED_RELEASE_TIP" ] || refuse "release branch changed since preparation"
  [ "$RELEASE_PUSH" = "$PREPARED_RELEASE_PUSH" ] || refuse "release-branch move changed since preparation"
  [ "$TEST_VERSION" = "$PREPARED_TEST_VERSION" ] && [ "$PRODUCTION_VERSION" = "$PREPARED_PROD_VERSION" ] \
    || refuse "a hosted build changed since preparation"
  [ -z "$NOTES_FILE" ] || { [ -f "$NOTES_FILE" ] && [ "$(sha256sum "$NOTES_FILE" | cut -d' ' -f1)" = "$PREPARED_NOTES_SHA" ]; } \
    || refuse "notes changed since preparation"
fi

if [ "$MODE" != approve ]; then
  # Every release starts in a browser that already runs the live build (T396). A failure stops it.
  node scripts/hosting/test/hosted-copies.e2e.mjs || refuse "hosted copies end-to-end test failed"

  # Compare this snapshot with current Latest and save the gallery outside the source tree.
  BEFORE=none
  [ -z "$LATEST_TAG" ] || BEFORE="https://snapshots.openisd.app/v/${LATEST_TAG#v}/"
  node scripts/ui-gallery/capture.mjs --after "https://snapshots.openisd.app/snap/$STAMP/" --before "$BEFORE" || refuse "UI gallery capture failed"
fi

if [ "$MODE" = prepare ]; then
  MANIFEST="$(pwd)/build/release-preflight/$STAMP-$PUBLIC.json"
  mkdir -p "$(dirname "$MANIFEST")"
  PREPARED_AT="$(date -u +%s)"
  EXPIRES_AT=$((PREPARED_AT + 7 * 24 * 60 * 60))
  NOTES_SHA=''
  [ -z "$NOTES_FILE" ] || NOTES_SHA="$(sha256sum "$NOTES_FILE" | cut -d' ' -f1)"
  node - "$MANIFEST" "$PUBLIC" "$STAMP" "$SHA" "$MAIN_SHA" "$LATEST_TAG" "$RELEASE_TIP" "$RELEASE_PUSH" "$NOTES_FILE" "$NOTES_SHA" "$TEST_VERSION" "$PRODUCTION_VERSION" "$PREPARED_AT" "$EXPIRES_AT" <<'NODE'
const fs = require('node:fs');
const [path, publicNumber, stamp, snapshotSha, mainSha, latestTag, releaseTip, releasePush,
  notesFile, notesSha256, testVersion, productionVersion, preparedAt, expiresAt] = process.argv.slice(2);
const record = {
  version: 1, public: publicNumber, stamp, snapshotSha, mainSha, latestTag,
  releaseTip, releasePush, notesFile, notesSha256, testVersion, productionVersion,
  preparedAt: Number(preparedAt), expiresAt: Number(expiresAt),
  checks: {hostedCopies: 'passed', uiGallery: 'passed'},
};
fs.writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, {mode: 0o600});
NODE
  echo "release: preflight passed for OpenISD $PUBLIC from $SNAP ($SHA)"
  echo "release: approval command: bash scripts/release.sh --approve-prepared \"$MANIFEST\""
  exit 0
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
dispatch_production_deploy "$REL"
echo "release: $REL is Latest at $SHA; RELEASES.md updated, commit it"
