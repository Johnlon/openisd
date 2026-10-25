#!/usr/bin/env bash
set -euo pipefail
rg -q 'reserved port.*4XXX' CLAUDE.md
rg -q 'reserved port.*4XXX' docs/DEV_PROCESS.md
rg -q '4XXX' docs/SDLC_DESIGN.md
