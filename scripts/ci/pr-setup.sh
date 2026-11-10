#!/usr/bin/env bash
# First step of every pull request check job (.github/workflows/pr.yml, T749). Run from the checkout (full history).
#
#   bash scripts/ci/pr-setup.sh <event-name> <merge-group-base-sha>
#
# Makes the runner look like the laptop for land.sh's gate scripts: origin/main is the commit the change is
# measured against (a pull request's merge commit has main's tip as its first parent; a merge group names its
# base), the runtime directory is writable, and OPENISD_CI_RUNNER switches off the laptop's memory pools.
# Exports for later steps, via GITHUB_ENV: PR_BASE, PR_TASK (the one task the change carries; none or two fail here).
set -euo pipefail
event="${1:?usage: pr-setup.sh <event-name> <merge-group-base-sha>}"; group_base="${2:-}"
case "$event" in
  pull_request) base="$(git rev-parse HEAD^1)" ;;
  merge_group) base="${group_base:?merge_group event without a base sha}" ;;
  *) echo "pr-setup: event '$event' is not pull_request or merge_group" >&2; exit 1 ;;
esac
git cat-file -e "$base^{commit}" 2> /dev/null || git fetch -q origin "$base"
git update-ref refs/remotes/origin/main "$base"
task="$(bash scripts/land/pr-task.sh origin/main HEAD)"
{
  echo "PR_BASE=$base"
  echo "PR_TASK=$task"
  echo "OPENISD_CI_RUNNER=1"
  echo "OPENISD_RUNTIME_DIR=${RUNNER_TEMP:-/tmp}/openisd-rt"
  echo "OPENISD_STATE_DIR=${RUNNER_TEMP:-/tmp}/openisd-state"
} >> "${GITHUB_ENV:?}"
echo "pr-setup: base ${base:0:10}, task $task, $(git rev-list --count origin/main..HEAD) commit(s)"
