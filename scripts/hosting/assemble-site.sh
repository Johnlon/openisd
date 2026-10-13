#!/usr/bin/env bash
# Rebuilds the whole GitHub Pages tree from the GitHub Releases, into <outdir>:
#   /                     the release GitHub marks Latest
#   /v/<stamp>/           every release
#   /snap/<stamp>/        every kept snapshot build
#   /v/index.json         both trails; /v/index.html and /snap/index.html list them
#   /dates.js             the index pages' date formatter bundle
# Releases are the only source: no branch holds a built site. While no release is marked Latest
# (before the first release) the root is the Versions page, so snapshot builds can be tried.
#
#   bash scripts/hosting/assemble-site.sh <outdir>
set -euo pipefail
OUT="${1:?usage: assemble-site.sh <outdir>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/assemble-site.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

rm -rf "$OUT"; mkdir -p "$OUT/v" "$OUT/snap"

gh api 'repos/{owner}/{repo}/releases' --paginate --jq '.[]' > "$WORK/releases.ndjson"
# GitHub answers 404 when no release is Latest; gh then exits non-zero and prints the error body.
# Capture status and output apart so that body is never taken for a tag.
if LATEST_OUT="$(gh api 'repos/{owner}/{repo}/releases/latest' --jq .tag_name 2> /dev/null)"; then LATEST_TAG="$LATEST_OUT"; else LATEST_TAG=''; fi

node "$HERE/siteIndex.mjs" "$WORK/releases.ndjson" "$LATEST_TAG" "$WORK/site"
node "$HERE/build-client.mjs" "$OUT/dates.js"

# unzip_build <tag> <stamp> <dest>: the release's openisd-<stamp>.zip into <dest>.
unzip_build() {
  local tag="$1" stamp="$2" dest="$3" dl="$WORK/dl-$1"
  mkdir -p "$dl" "$dest"
  gh release download "$tag" --pattern "openisd-$stamp.zip" --dir "$dl"
  unzip -q -o "$dl/openisd-$stamp.zip" -d "$dest"
  rm -rf "$dl"
}

# Latest first at the root, then every build in its own folder. jq reads the index just written.
if [ -n "$LATEST_TAG" ]; then
  LATEST_STAMP="$(jq -r --arg t "$LATEST_TAG" '.[] | select(.tag == $t) | .stamp' "$WORK/site/v/index.json")"
  [ -n "$LATEST_STAMP" ] || { echo "assemble-site: Latest release $LATEST_TAG is not a build of ours" >&2; exit 1; }
  unzip_build "$LATEST_TAG" "$LATEST_STAMP" "$OUT"
else
  echo "assemble-site: no release is marked Latest yet; the root is the Versions page" >&2
  cp "$WORK/site/v/index.html" "$OUT/index.html"
  # Devices that opened the old root app keep its service worker until this URL serves a new one.
  cp "$HERE/killSwitchWorker.js" "$OUT/sw.js"
fi
while IFS=$'\t' read -r kind tag stamp; do
  case "$kind" in
    release) unzip_build "$tag" "$stamp" "$OUT/v/$stamp" ;;
    snap)    unzip_build "$tag" "$stamp" "$OUT/snap/$stamp" ;;
  esac
done < <(jq -r '.[] | [.kind, .tag, .stamp] | @tsv' "$WORK/site/v/index.json")

cp "$WORK/site/v/index.json" "$WORK/site/v/index.html" "$OUT/v/"
cp "$WORK/site/snap/index.html" "$OUT/snap/"
echo "assemble-site: $(jq length "$OUT/v/index.json") builds, Latest ${LATEST_TAG:-none} → $OUT"
