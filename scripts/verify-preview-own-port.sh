#!/usr/bin/env bash
# Health-check "Verify Preview": starts a throwaway Vite dev server on a port reserved for this run
# (never 4000, which is John's live preview) and runs verify-preview.sh against it.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
# shellcheck source=./test-concurrency.sh
source "$SCRIPT_DIR/test-concurrency.sh"
reserve_test_slot
VITE_PID=""
cleanup() {
  [ -n "$VITE_PID" ] && kill "$VITE_PID" 2>/dev/null || true
  release_test_slot
}
trap cleanup EXIT
npx vite --port "$OPENISD_TEST_PORT" --strictPort >"build/verify-preview-$OPENISD_TEST_PORT.log" 2>&1 &
VITE_PID=$!
for _ in $(seq 1 90); do
  curl -s -o /dev/null "http://localhost:$OPENISD_TEST_PORT/@vite/client" && break
  sleep 1
done
OPENISD_PREVIEW_PORT="$OPENISD_TEST_PORT" bash "$SCRIPT_DIR/verify-preview.sh"
