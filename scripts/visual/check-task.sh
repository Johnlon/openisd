#!/usr/bin/env bash
# The land gate for baselines: a task changes exactly the screens it lists under `visual:` in its task
# file. A baseline picture that changed without being listed, or a listed screen whose picture did not
# change, refuses the landing.
#   bash scripts/visual/check-task.sh <task.yml>... <base> <head>
# A pull request carrying several tasks (T762) names every task file: the screens they list are pooled.
set -euo pipefail
[ "$#" -ge 3 ] || { echo "usage: check-task.sh <task.yml>... <base> <head>" >&2; exit 2; }
tasks=("${@:1:$#-2}"); base="${*: -2:1}"; head="${*: -1}"
# shellcheck source=./lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
listed="$(for task in "${tasks[@]}"; do visual_screen_ids "$task"; done | sort -u)"; changed="$(visual_changed_ids "$base" "$head")"
unlisted="$(comm -13 <(printf '%s\n' "$listed") <(printf '%s\n' "$changed") | sed '/^$/d')"
unchanged="$(comm -23 <(printf '%s\n' "$listed") <(printf '%s\n' "$changed") | sed '/^$/d')"
status=0
if [ -n "$changed" ] && [ -z "$(for task in "${tasks[@]}"; do visual_note "$task"; done)" ]; then
  echo "visual: warning: ${tasks[*]} has no visual_note: (one or two plain sentences on what the user sees change); the change page cannot say what to look at"
fi
if [ -n "$unlisted" ]; then
  printf 'visual: baselines changed that the task does not list under visual: in its task file:\n%s\n' "$(printf '%s\n' "$unlisted" | sed 's/^/  /')"; status=1
fi
if [ -n "$unchanged" ]; then
  printf 'visual: the task lists screens whose baseline did not change:\n%s\n' "$(printf '%s\n' "$unchanged" | sed 's/^/  /')"; status=1
fi
exit "$status"
