#!/usr/bin/env bash
# bash /home/john/work/winisd/openisd/scripts/budget.sh <pool> <MB> [--cpu <cores>] -- <command> [args...]
# Machine-wide: any repo calls it by that absolute path from its own cwd (winisd tools, ui-gallery, zoo jobs);
# it needs nothing from the caller's repo. Pools: small, general (the old "suite" is an alias of general).
# Starts the command when <MB> of the pool's memory AND <cores> CPU cores (default 1) are free, otherwise waits and
# says so, with the load average. Memory and CPU are rows of tokens (scripts/budget.conf: TOKEN_MB each; CPU_TOKENS
# cores), each a flock on a file; a job holds the tokens it took until it and everything it started has ended, and the
# kernel releases them however it ends. It holds all its tokens or none: if either kind is short it lets go of
# everything and blocks on every busy token of both kinds (scripts/budget-wait.py: the first to free wakes it), so
# there is no polling. One waiter per pool holds the pool gate, so jobs are served in arrival order and a big job is
# not starved by a stream of small ones. More cores than CPU_TOKENS is capped at CPU_TOKENS (it can always run alone).
# BUDGET_CONF and BUDGET_DIR replace the config file and the lock directory in tests.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=paths.sh
. "$HERE/paths.sh"
# shellcheck source=budget.conf
. "${BUDGET_CONF:-$HERE/budget.conf}"
usage() { echo "usage: budget.sh <pool> <MB> [--cpu <cores>] -- <command> [args...]" >&2; exit 2; }
pool="${1:-}"; mb="${2:-}"; shift 2 2> /dev/null || true
cpu=1
if [ "${1:-}" = "--cpu" ]; then cpu="${2:-}"; shift 2 2> /dev/null || usage; fi
[ "${1:-}" = "--" ] && shift
[ -n "$pool" ] && [ -n "$mb" ] && [ $# -gt 0 ] || usage
case "$mb$cpu" in *[!0-9]*) usage ;; esac
[ "$pool" = none ] && exec "$@"
[ "$pool" = suite ] && pool=general
case "$pool" in small) pool_mb=$POOL_SMALL_MB ;; general) pool_mb=$POOL_GENERAL_MB ;; *) echo "budget: unknown pool '$pool'" >&2; exit 2 ;; esac

need=$(( (mb + TOKEN_MB - 1) / TOKEN_MB ))
size=$(( pool_mb / TOKEN_MB ))
if [ "$need" -gt "$size" ]; then
  echo "budget: $mb MB can never fit the $pool pool ($pool_mb MB); the figures in budget.conf are wrong" >&2
  exit 2
fi
if [ "$cpu" -gt "$CPU_TOKENS" ]; then
  echo "budget: $cpu cores asked, the machine has $CPU_TOKENS; capped at $CPU_TOKENS" >&2
  cpu=$CPU_TOKENS
fi
root="${BUDGET_DIR:-$OPENISD_RUNTIME_DIR/budget}"
dir="$root/$pool"
cpudir="$root/cpu"
mkdir -p "$dir" "$cpudir"

. "$HERE/lib/ts-log.sh"
run_start "budget-wait-$pool"
exec {gate}> "$dir/gate"
exec {cpugate}> "$cpudir/gate"
loadavg() { cut -d' ' -f1-3 /proc/loadavg; }
announced=0
held=()
heldc=()
while :; do
  # The pool gate is held while this job looks for tokens and while it waits for one, and let go before the command starts.
  if [ "$announced" = 0 ] && ! flock -n "$gate"; then
    echo "budget: waiting for the $pool pool ($mb MB, $cpu cores): another job is ahead in the queue (load $(loadavg))" >&2
    announced=1
  fi
  flock "$gate"
  held=()
  heldc=()
  busy=()
  short=""
  for ((i = 1; i <= size && ${#held[@]} < need; i++)); do
    exec {fd}> "$dir/t$i"
    if flock -n "$fd"; then held+=("$fd"); else busy+=("$dir/t$i"); exec {fd}>&-; fi
  done
  [ ${#held[@]} -ge "$need" ] || short="memory"
  # The cores are scanned under the shared cpu gate, so two jobs of different pools never hold half each.
  flock "$cpugate"
  for ((i = 1; i <= CPU_TOKENS && ${#heldc[@]} < cpu; i++)); do
    exec {fd}> "$cpudir/t$i"
    if flock -n "$fd"; then heldc+=("$fd"); else busy+=("$cpudir/t$i"); exec {fd}>&-; fi
  done
  [ ${#heldc[@]} -ge "$cpu" ] || short="${short:+$short and }cpu"
  if [ -z "$short" ]; then flock -u "$cpugate"; break; fi
  # Not enough free: let go of everything taken, and wait (blocking, no polling) for a busy token of either kind to free.
  for fd in "${held[@]}" "${heldc[@]}"; do exec {fd}>&-; done
  flock -u "$cpugate"
  if [ "$announced" = 0 ]; then
    echo "budget: waiting for the $pool pool: $mb MB and $cpu cores needed, not enough $short is free (load $(loadavg))" >&2
    announced=1
  fi
  python3 -I "$HERE/budget-wait.py" "${busy[@]}"
done
exec {gate}>&- {cpugate}>&-
run_end "budget-wait-$pool" 0
[ "$announced" = 0 ] || echo "budget: the $pool pool has $mb MB and $cpu cores free now; starting (load $(loadavg))" >&2
exec "$@"
