#!/usr/bin/env bash
# bash scripts/budget.sh <pool> <MB> -- <command> [args...]
# Starts the command when <MB> of the pool's memory is free, otherwise waits and says so. The pool is a row
# of tokens (scripts/budget.conf: TOKEN_MB each), each a flock on a file; a job holds the tokens it took until
# it and everything it started has ended, and the kernel releases them however it ends. Waiting is a blocking
# flock on every token that is in use (scripts/budget-wait.py: the first to free wakes it), so there is no polling. One waiter at a time holds the gate, so jobs are
# served in arrival order and a big job is not starved by a stream of small ones.
# BUDGET_CONF and BUDGET_DIR replace the config file and the lock directory in tests.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=paths.sh
. "$HERE/paths.sh"
# shellcheck source=budget.conf
. "${BUDGET_CONF:-$HERE/budget.conf}"
pool="${1:-}"; mb="${2:-}"; shift 2 2> /dev/null || true
[ "${1:-}" = "--" ] && shift
[ -n "$pool" ] && [ -n "$mb" ] && [ $# -gt 0 ] || { echo "usage: budget.sh <pool> <MB> -- <command> [args...]" >&2; exit 2; }
[ "$pool" = none ] && exec "$@"
case "$pool" in suite) pool_mb=$POOL_SUITE_MB ;; small) pool_mb=$POOL_SMALL_MB ;; general) pool_mb=$POOL_GENERAL_MB ;; *) echo "budget: unknown pool '$pool'" >&2; exit 2 ;; esac

need=$(( (mb + TOKEN_MB - 1) / TOKEN_MB ))
size=$(( pool_mb / TOKEN_MB ))
if [ "$need" -gt "$size" ]; then
  echo "budget: $mb MB can never fit the $pool pool ($pool_mb MB); the figures in budget.conf are wrong" >&2
  exit 2
fi
dir="${BUDGET_DIR:-$OPENISD_RUNTIME_DIR/budget}/$pool"
mkdir -p "$dir"

exec {gate}> "$dir/gate"
announced=0
held=()
while :; do
  # The gate is held while this job looks for tokens and while it waits for one, and let go before the command starts.
  if [ "$announced" = 0 ] && ! flock -n "$gate"; then
    echo "budget: waiting for the $pool pool ($mb MB): another job is ahead in the queue" >&2
    announced=1
  fi
  flock "$gate"
  held=()
  busy=()
  for ((i = 1; i <= size && ${#held[@]} < need; i++)); do
    exec {fd}> "$dir/t$i"
    if flock -n "$fd"; then held+=("$fd"); else busy+=("$dir/t$i"); exec {fd}>&-; fi
  done
  [ ${#held[@]} -ge "$need" ] && break
  # Not enough free: let go of what was taken, and wait (blocking, no polling) for the busy token to free.
  for fd in "${held[@]}"; do exec {fd}>&-; done
  if [ "$announced" = 0 ]; then
    echo "budget: waiting for the $pool pool: $mb MB needed, not enough is free" >&2
    announced=1
  fi
  python3 -I "$HERE/budget-wait.py" "${busy[@]}"
done
exec {gate}>&-
[ "$announced" = 0 ] || echo "budget: the $pool pool has $mb MB free now; starting" >&2
exec "$@"
