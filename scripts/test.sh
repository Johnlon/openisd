#!/usr/bin/env bash
# `npm test` — the project's test entry point.
#
#   npm test                                       full gate: unit suite, then browser suite
#   npm test packages/engine/test/sealed-fc.test.ts        ONE vitest file
#   npm test packages/ui/test/ui/visual.browser.spec.ts    ONE playwright spec
#
# WHY THIS SCRIPT EXISTS. The entry point used to be the literal string
# `npm run test:unit && bash scripts/test-browser.sh`. npm appends a script's arguments to the
# END of that string, so `npm test <one-file>` ran the WHOLE unit suite (vitest never saw the
# path) and then handed the path to Playwright — which for a vitest file matches nothing. A
# request for one file therefore ran everything, or ran everything and then failed. AGENTS.md:42
# tells every contributor and agent to run the single target file during the TDD loop, and this
# is the command they reach for; it has to mean what it says.
#
# The two suites take DIFFERENT runners, so one path cannot simply be forwarded to both. The
# suffix decides, using playwright.config.js's own testMatch convention: *.browser.spec.ts is a
# Playwright spec, anything else is vitest. An argument that names no target at all is an ERROR
# — silently widening a narrow request to the full suite is the failure this script removes.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── No arguments: the full gate, both suites, unit first (fail fast on the cheap one) ────────
if [ "$#" -eq 0 ]; then
  npx vitest run
  bash "$SCRIPT_DIR/test-browser.sh"
  exit 0
fi

# ── Arguments: route to the runner that owns the named target ────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    *.browser.spec.ts)
      exec bash "$SCRIPT_DIR/test-browser.sh" "$@"
      ;;
  esac
done

for arg in "$@"; do
  case "$arg" in
    -*) ;;                       # a flag names no target
    */*|*.test.ts|*.test.js|*.test.mjs)
      exec npx vitest run "$@"
      ;;
  esac
done

cat >&2 <<EOF
ERROR: no test target in the arguments: $*

An argument list with no file, directory or spec in it is not a narrow run, and this script
will not silently expand it into the full suite. Name a target:

  npm test packages/engine/test/sealed-fc.test.ts        one vitest file
  npm test packages/ui/test/ui/visual.browser.spec.ts    one playwright spec (add --workers=1)
  npm test                                               the full gate, both suites

A *.browser.spec.ts target goes to scripts/test-browser.sh; anything else goes to vitest.
EOF
exit 1
