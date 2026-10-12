#!/usr/bin/env bash
# Install the watchdog timer for this user. Run from the main checkout after S3 has landed:
#   bash scripts/land/watchdog-install.sh
# Symlinks the units into ~/.config/systemd/user/ as openisd-watchdog.{service,timer} and enables the timer.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${WATCHDOG_UNIT_DIR:-$HOME/.config/systemd/user}"
mkdir -p "$DEST"
for kind in service timer; do ln -sfn "$HERE/watchdog.$kind" "$DEST/openisd-watchdog.$kind"; done
systemctl --user daemon-reload
systemctl --user enable --now openisd-watchdog.timer
echo "watchdog timer installed: $DEST/openisd-watchdog.{service,timer}"
