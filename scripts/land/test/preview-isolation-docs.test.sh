#!/usr/bin/env bash
set -euo pipefail
grep -qE 'reserved port.*4XXX' CLAUDE.md
grep -qE 'reserved port.*4XXX' docs/DEV_PROCESS.md
grep -qE '4XXX' docs/SDLC_DESIGN.md
