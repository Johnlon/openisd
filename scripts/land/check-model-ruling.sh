#!/usr/bin/env bash
# Land gate: the driver model files change only with John's ruling (QO392, 3 Nov 2026: "yes lock the
# openisd.json model changes without my ruling as this is visible to users and can break them").
# The task file must carry `ruling: QO<n>`, naming the board item where he ruled.
#   bash scripts/land/check-model-ruling.sh <task> <base> <head>      run from the repo root
set -euo pipefail
task="${1:?usage: check-model-ruling.sh <task> <base> <head>}"; base="${2:?}"; head="${3:?}"
# The one list of locked driver model files (QO392).
MODEL_FILES=(
  packages/design/domain/openisdSchema.ts
  packages/design/domain/driver/openIsdDriverSpec.ts
  packages/design/domain/driver/driverSpecFieldName.ts
)
changed="$(git diff --name-only "$base" "$head" -- "${MODEL_FILES[@]}")"
[ -n "$changed" ] || exit 0
ruling="$(sed -n 's/^ruling: *//p' "tasks/$task.yml" 2> /dev/null | head -n 1 | tr -d ' \r')"
if printf '%s' "$ruling" | grep -Eq '^QO[0-9]+$'; then exit 0; fi
printf 'model-ruling: this landing changes driver model files:\n%s\n' "$(printf '%s\n' "$changed" | sed 's/^/  /')"
printf 'driver model change needs John'"'"'s ruling: add `ruling: QO<n>` to tasks/%s.yml naming the board item where he ruled (QO392)\n' "$task"
exit 1
