#!/usr/bin/env bash
# Keeps the newest 20 snapshot builds: older snapshot pre-releases and their snap- tags are deleted.
# The Pages folders go with them on the next deploy, which rebuilds the whole site from releases.
# Only pre-releases are touched; a promoted release is never pruned.
set -euo pipefail
KEEP="${SNAP_KEEP:-20}"

gh release list --limit 500 --json tagName,isPrerelease --jq '.[] | select(.isPrerelease and (.tagName | startswith("snap-"))) | .tagName' \
  | sort -r | tail -n "+$((KEEP + 1))" \
  | while read -r tag; do
      echo "snap-prune: deleting $tag"
      gh release delete "$tag" --cleanup-tag --yes
    done
