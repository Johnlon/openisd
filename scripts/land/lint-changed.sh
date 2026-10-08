#!/usr/bin/env bash
# The lint gate of scripts/land.sh: bash scripts/land/lint-changed.sh <changed file…>
# Lints only the changed files that ESLint covers (ts, vue, js, mjs); anything else is skipped.
# The full lint runs in CI and the post-land run.
set -uo pipefail
files=()
for f in "$@"; do
  case "$f" in
    *.ts|*.tsx|*.vue|*.js|*.mjs|*.cjs) [ -f "$f" ] && files+=("$f") ;;
  esac
done
[ "${#files[@]}" -gt 0 ] || { echo "lint: no lintable file changed"; exit 0; }
exec npx eslint --max-warnings 0 --no-warn-ignored "${files[@]}"
