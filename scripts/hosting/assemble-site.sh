#!/usr/bin/env bash
# Rebuilds the three GitHub Pages sites from the GitHub Releases, into <outdir>:
#   prod/        openisd.app: the release GitHub marks Latest, nothing else (T398). The old
#                addresses of the copies, test/, v/<stamp>/ and snap/<stamp>/, hold a page that
#                sends the visitor to the new site, and the kill-switch worker, which removes the
#                copy's old service worker. v/index.json stays for released apps that read it there.
#   test/        test.openisd.app: the newest snapshot at the root. One stable address for testing
#                (Google sign-in needs a registered redirect URI; John, 14 Oct 2026).
#   snapshots/   snapshots.openisd.app: v/<stamp>/ every release, snap/<stamp>/ every kept snapshot
#                build, v/index.json both trails, v/index.html and snap/index.html list them,
#                dates.js their date formatter bundle.
# Each site is its own origin, so a copy never shares storage or a service worker with production.
# The test and snapshots sites carry a CNAME file; openisd.app's domain is set on its repo.
# Releases are the only source: no branch holds a built site. While no release is marked Latest
# (before the first release) openisd.app's root is the releases list.
#
#   bash scripts/hosting/assemble-site.sh <outdir>
set -euo pipefail
OUT="${1:?usage: assemble-site.sh <outdir>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/assemble-site.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
TEST_HOST=test.openisd.app
SNAPSHOTS_HOST=snapshots.openisd.app
P="$OUT/prod" T="$OUT/test" N="$OUT/snapshots"

rm -rf "$OUT"; mkdir -p "$P/v" "$P/snap" "$T" "$N/v" "$N/snap"

gh api 'repos/{owner}/{repo}/releases' --paginate --jq '.[]' > "$WORK/releases.ndjson"
# GitHub answers 404 when no release is Latest; gh then exits non-zero and prints the error body.
# Capture status and output apart so that body is never taken for a tag.
if LATEST_OUT="$(gh api 'repos/{owner}/{repo}/releases/latest' --jq .tag_name 2> /dev/null)"; then LATEST_TAG="$LATEST_OUT"; else LATEST_TAG=''; fi

node "$HERE/siteIndex.mjs" "$WORK/releases.ndjson" "$LATEST_TAG" "$WORK/site"
node "$HERE/build-client.mjs" "$N/dates.js"

# unzip_build <tag> <stamp> <dest>: the release's openisd-<stamp>.zip into <dest>.
unzip_build() {
  local tag="$1" stamp="$2" dest="$3" dl="$WORK/dl-$1"
  mkdir -p "$dl" "$dest"
  gh release download "$tag" --pattern "openisd-$stamp.zip" --dir "$dl"
  unzip -q -o "$dl/openisd-$stamp.zip" -d "$dest"
  rm -rf "$dl"
}

# moved_page <dir> <address>: a page at <dir> that sends the visitor to <address>.
moved_page() {
  mkdir -p "$1"
  cat > "$1/index.html" <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=$2">
<title>OpenISD: moved</title>
</head>
<body style="background:#0b0e13;color:#c7d3df;font:15px/1.5 system-ui,sans-serif;padding:20px">
<p>This is now at <a style="color:#4fb0ff" href="$2">$2</a></p>
<script>location.replace('$2');</script>
</body>
</html>
HTML
}
# moved_build <dir> <address>: a build that sat at <dir> on openisd.app now lives at <address>. Its
# old service worker would go on answering from its cache, so the kill switch replaces it.
moved_build() {
  moved_page "$1" "$2"
  cp "$HERE/killSwitchWorker.js" "$1/sw.js"
}

# openisd.app: Latest at the root.
if [ -n "$LATEST_TAG" ]; then
  LATEST_STAMP="$(jq -r --arg t "$LATEST_TAG" '.[] | select(.tag == $t) | .stamp' "$WORK/site/v/index.json")"
  [ -n "$LATEST_STAMP" ] || { echo "assemble-site: Latest release $LATEST_TAG is not a build of ours" >&2; exit 1; }
  unzip_build "$LATEST_TAG" "$LATEST_STAMP" "$P"
else
  echo "assemble-site: no release is marked Latest yet; the root is the releases list" >&2
  cp "$WORK/site/v/index.html" "$P/index.html"
  # Devices that opened the old root app keep its service worker until this URL serves a new one.
  cp "$HERE/killSwitchWorker.js" "$P/sw.js"
fi

# snapshots.openisd.app: every build in its own folder; its old folder on openisd.app sends you there.
while IFS=$'\t' read -r kind tag stamp; do
  case "$kind" in
    release) unzip_build "$tag" "$stamp" "$N/v/$stamp"; moved_build "$P/v/$stamp" "https://$SNAPSHOTS_HOST/v/$stamp/" ;;
    snap)    unzip_build "$tag" "$stamp" "$N/snap/$stamp"; moved_build "$P/snap/$stamp" "https://$SNAPSHOTS_HOST/snap/$stamp/" ;;
  esac
done < <(jq -r '.[] | [.kind, .tag, .stamp] | @tsv' "$WORK/site/v/index.json")
cp "$WORK/site/v/index.json" "$WORK/site/v/index.html" "$N/v/"
cp "$WORK/site/snap/index.html" "$N/snap/"
# The list pages' icon, from any build.
ICON="$(find "$N/v" "$N/snap" -maxdepth 2 -name icon.svg | head -1)"
[ -z "$ICON" ] || cp "$ICON" "$N/icon.svg"
moved_page "$N" "./v/"
echo "$SNAPSHOTS_HOST" > "$N/CNAME"
moved_page "$P/v" "https://$SNAPSHOTS_HOST/v/"
moved_page "$P/snap" "https://$SNAPSHOTS_HOST/snap/"
cp "$WORK/site/v/index.json" "$P/v/"

# test.openisd.app: the newest snapshot (the stamps sort as text). Nothing before the first one.
NEWEST_SNAP="$(jq -r '[.[] | select(.kind == "snap") | .stamp] | sort | last // empty' "$WORK/site/v/index.json")"
if [ -n "$NEWEST_SNAP" ]; then
  cp -R "$N/snap/$NEWEST_SNAP/." "$T/"
  echo "assemble-site: test.openisd.app is snapshot $NEWEST_SNAP" >&2
fi
echo "$TEST_HOST" > "$T/CNAME"
moved_build "$P/test" "https://$TEST_HOST/"

echo "assemble-site: $(jq length "$N/v/index.json") builds, Latest ${LATEST_TAG:-none} → $P, $T, $N"
