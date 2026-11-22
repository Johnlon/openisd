#!/usr/bin/env bash
# Installs heavy.slice (every heavy job: lint, unit tests, gates, browser runs, the suite) for the user
# manager and reloads it. Run when no landing and no post-land run is active: heavy.slice's ceiling
# changes under any job already in it. Each file is replaced atomically.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${SYSTEMD_USER_DIR:-$HOME/.config/systemd/user}"
mkdir -p "$DEST"
for unit in heavy.slice; do
  cp "$HERE/$unit" "$DEST/$unit.new.$$"
  mv -f "$DEST/$unit.new.$$" "$DEST/$unit"
done
[ -n "${SYSTEMD_USER_DIR:-}" ] || systemctl --user daemon-reload
echo "installed heavy.slice into $DEST"
