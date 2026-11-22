#!/usr/bin/env bash
# Publishes a built site folder as the whole of a repository's gh-pages branch, which GitHub Pages
# serves (test.openisd.app, snapshots.openisd.app; T398). One commit, force-pushed: the builds come
# from the GitHub Releases, so the branch keeps no history of them. .nojekyll makes Pages serve
# every file as it is.
#   bash scripts/hosting/push-site.sh <site-dir> <remote>
# The caller supplies the credentials (deploy.yml sets GIT_SSH_COMMAND to the repo's deploy key).
set -euo pipefail
SITE="${1:?usage: push-site.sh <site-dir> <remote>}"
REMOTE="${2:?usage: push-site.sh <site-dir> <remote>}"
[ -d "$SITE" ] || { echo "push-site: no folder $SITE" >&2; exit 1; }
SITE="$(cd "$SITE" && pwd)"
GIT_DIR_TMP="$(mktemp -d "${TMPDIR:-/tmp}/push-site.XXXXXX")"
trap 'rm -rf "$GIT_DIR_TMP"' EXIT
touch "$SITE/.nojekyll"
g() { git --git-dir="$GIT_DIR_TMP" --work-tree="$SITE" "$@"; }
g init -q -b gh-pages
g add -A
g -c user.name='OpenISD deploy' -c user.email='deploy@openisd.app' commit -q -m "Site from $(basename "$SITE")"
g push -q --force "$REMOTE" gh-pages:gh-pages
echo "push-site: $SITE → $REMOTE gh-pages ($(g ls-files | wc -l) files)"
