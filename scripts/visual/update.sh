#!/usr/bin/env bash
# Re-takes the baseline pictures after a change that alters screens on purpose (T799).
#   bash scripts/visual/update.sh
# Pictures are drawn only by CI's test machine (.github/workflows/visual-retake.yml): a picture drawn anywhere else
# differs from what the suite's browser job draws, and T791's 37 such pictures turned main red. So this never draws
# here: it commits-checks, asks CI to draw every screen on your commit (retake-ci.sh), and brings back the pictures that
# differ, stamped with the run that drew them, plus packages/ui/test/visual/SOURCES.sha256 for your UI sources.
# Then list the screens that changed under `visual:` in the task file, and add the pictures and SOURCES.sha256 to files:.
# A screen is re-taken whole: there is no per-screen form, since CI draws all of them in one run anyway.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
[ "$#" -eq 0 ] || { echo "update.sh: takes no arguments; CI re-takes every screen and only the pictures that differ change" >&2; exit 2; }
exec bash scripts/visual/retake-ci.sh
