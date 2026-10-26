#!/usr/bin/env bash
# Stable releases dispatch Pages deployment from main and require a live build-ID match.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
release="$ROOT/.github/workflows/release.yml"
deploy="$ROOT/.github/workflows/deploy.yml"
suite="$ROOT/.github/workflows/suite.yml"
promote="$ROOT/scripts/release.sh"
build="$ROOT/.github/workflows/build.yml"

assert_contains() {
  local file="$1" needle="$2"
  grep -Fq "$needle" "$file" || { echo "FAIL $file is missing: $needle" >&2; exit 1; }
}

assert_contains "$release" "if: github.ref_type == 'branch'"
assert_contains "$release" 'scripts/release.sh command dispatches deploy.yml from main'
assert_contains "$promote" 'gh workflow run deploy.yml --ref main --field publish_production=true --field expected_build_id="$release_tag"'
assert_contains "$deploy" 'expected_build_id:'
assert_contains "$deploy" 'publish_production:'
assert_contains "$deploy" "if: \${{ inputs.publish_production && inputs.expected_build_id != '' }}"
if grep -Eq 'publish_production:' "$build"; then
  echo 'FAIL snapshot workflow opts in to production publishing' >&2
  exit 1
fi
assert_contains "$deploy" 'EXPECTED_BUILD_ID: ${{ inputs.expected_build_id }}'
assert_contains "$deploy" 'openisd.app/build-info.json?deploy-check='
assert_contains "$deploy" 'actual_build_id'
assert_contains "$suite" 'if: matrix.shard == 1'
assert_contains "$suite" 'node scripts/hosting/test/legacy-refresh.e2e.mjs'

echo 'ok stable releases deploy from main and verify the live build ID'
