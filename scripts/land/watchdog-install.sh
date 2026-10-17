#!/usr/bin/env bash
# Install the watchdog timer for this user: bash scripts/land/watchdog-install.sh
# Copies (never symlinks: a link into the main checkout reads whatever that checkout holds, T304) the units
# into ~/.config/systemd/user/ as openisd-watchdog.{service,timer} and watchdog-boot.sh into
# ~/.local/libexec/openisd/, then enables the timer. Run it only when no landing or post-land run is active
# (processes.md rule 7). WATCHDOG_UNIT_DIR, WATCHDOG_BOOT_DIR and WATCHDOG_NO_SYSTEMCTL=1 are for tests.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${WATCHDOG_UNIT_DIR:-$HOME/.config/systemd/user}"
BOOT="${WATCHDOG_BOOT_DIR:-$HOME/.local/libexec/openisd}"
mkdir -p "$DEST" "$BOOT"
install -m 0755 "$HERE/watchdog-boot.sh" "$BOOT/watchdog-boot.sh.new" && mv -f "$BOOT/watchdog-boot.sh.new" "$BOOT/watchdog-boot.sh"
for kind in service timer; do
  rm -f "$DEST/openisd-watchdog.$kind"   # an old symlink into the checkout
  install -m 0644 "$HERE/watchdog.$kind" "$DEST/openisd-watchdog.$kind"
done
if [ "${WATCHDOG_NO_SYSTEMCTL:-}" != 1 ]; then
  systemctl --user daemon-reload
  systemctl --user enable --now openisd-watchdog.timer
fi
echo "watchdog installed: $DEST/openisd-watchdog.{service,timer}, $BOOT/watchdog-boot.sh"
