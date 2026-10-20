#!/usr/bin/env bash
# Build the browser suite's app (kill-http, version-info, per-port test bundle, `vite build --mode test`) BEFORE
# Playwright starts. Deterministic, so it has no deadline: Playwright's webServer limit used to cover it and
# failed whole runs under load (T489, load audit row 8). Playwright's webServer then only serves the result.
#
#   OPENISD_TEST_PORT=<port> bash scripts/build-test-app.sh
# The command is BUILD_TEST_APP in playwright.config.js, the one definition CI also runs (.github/workflows/suite.yml).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
: "${OPENISD_TEST_PORT:?build-test-app.sh: OPENISD_TEST_PORT is not set}"
bash -c "$(node --input-type=module -e "import('./playwright.config.js').then(m => process.stdout.write(m.BUILD_TEST_APP))")"
