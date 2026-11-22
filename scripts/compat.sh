#!/usr/bin/env bash
# Compatibility suite: run from the repo root. `bash scripts/compat.sh --list`, `bash scripts/compat.sh pr`.
# Not part of the pre-commit suite. See packages/design/compat/README.md.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
exec npx vite-node packages/design/compat/run.ts -- "$@"
