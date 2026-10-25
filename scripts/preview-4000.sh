#!/usr/bin/env bash
# Restart the canonical live Vite development server on port 4000 with HMR.
# It runs as the openisd-preview systemd user unit (copy in scripts/systemd/), which restarts it if it dies.
# Source edits are served immediately. The unit must never be changed to `vite preview`.
set -euo pipefail
systemctl --user restart openisd-preview
systemctl --user --no-pager --lines=0 status openisd-preview
