#!/usr/bin/env bash
# The land gate for baselines: a task changes exactly the screens it lists under `visual:` in its task
# file. A baseline picture that changed without being listed, or a listed screen whose picture did not
# change, refuses the landing.
#   bash scripts/visual/check-task.sh <task.yml> <base> <head>
set -euo pipefail
task="${1:?usage: check-task.sh <task.yml> <base> <head>}"; base="${2:?}"; head="${3:?}"
# shellcheck source=./lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
listed="$(visual_screen_ids "$task")"; changed="$(visual_changed_ids "$base" "$head")"
unlisted="$(comm -13 <(printf '%s\n' "$listed") <(printf '%s\n' "$changed") | sed '/^$/d')"
unchanged="$(comm -23 <(printf '%s\n' "$listed") <(printf '%s\n' "$changed") | sed '/^$/d')"
status=0
if [ -n "$unlisted" ]; then
  printf 'visual: baselines changed that the task does not list under visual: in its task file:\n%s\n' "$(printf '%s\n' "$unlisted" | sed 's/^/  /')"; status=1
fi
if [ -n "$unchanged" ]; then
  printf 'visual: the task lists screens whose baseline did not change:\n%s\n' "$(printf '%s\n' "$unchanged" | sed 's/^/  /')"; status=1
fi
exit "$status"
