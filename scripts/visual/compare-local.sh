#!/usr/bin/env bash
# Compare the visual spec with the committed pictures on THIS machine (comparison only: nothing is drawn, and
# scripts/test.sh still refuses --update-snapshots). It is the suite's browser job with the test server on port 4300,
# the stand-in for the release address (the pictures show "saved in this browser at https://openisd.app/") finds its build by
# that port; scripts/test.sh hands out a pooled port (4100+) instead.
#   bash scripts/visual/compare-local.sh [playwright arguments, e.g. -g "visual desktop tab-box"]
# A difference here is a real difference (the app draws only in its bundled fonts, the browser's time zone is UTC): read it.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
export OPENISD_TEST_PORT=4300
for arg in "$@"; do
  case "$arg" in -u|--update-snapshots|--update-snapshots=*) echo "ERROR: pictures are drawn by CI only: bash scripts/visual/update.sh" >&2; exit 1 ;; esac
done
bash -c "$(node --input-type=module -e "import('./playwright.config.js').then(m => process.stdout.write(m.BUILD_TEST_APP))")"
exec npx playwright test packages/ui/test/visual/visual.browser.spec.ts --retries=0 "$@"
