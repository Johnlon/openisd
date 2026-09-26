#!/bin/sh
# Fair-share concurrency for the heavy lint+typecheck+test gate (pre-commit, pre-push).
#
# Several agent sessions committing around the same time each spawned a full, unthrottled
# tsc/vue-tsc/vitest tree; four or five of those at once drove load average to 26 on a 10-core
# box and forced an emergency `killall node` (2026-09-26). The fix is NOT a mutex: a session
# doing a single targeted `vitest run <file>` during its TDD loop must never queue behind
# another session's full gate — this script is never sourced by that path at all, only by the
# full pre-commit/pre-push gate. Among THOSE, every session still gets to run immediately; what
# shrinks under contention is how many workers each one gets, shared out by how many gates are
# active right now — same reservation-accounting shape as scripts/test-concurrency.sh (CPU here,
# memory there).
#
# Source it, don't exec it — the reservation is keyed on this shell's own PID ($$), so
# release_heavy_gate_slot must run in the SAME shell that reserved it:
#
#   . "$(git rev-parse --show-toplevel)/scripts/hooks-local/heavy-gate-concurrency.sh"
#   reserve_heavy_gate_slot
#   trap release_heavy_gate_slot EXIT
#
# Sets OPENISD_HEAVY_GATE_WORKERS: how many of the 3 typecheck programs, and how many vitest
# worker threads, THIS run should use.

OPENISD_HEAVY_GATE_DIR="${OPENISD_HEAVY_GATE_DIR:-/tmp/openisd-heavy-gate-reservations}"
OPENISD_HEAVY_GATE_ACCOUNTING_LOCK="${OPENISD_HEAVY_GATE_DIR}.lock"
mkdir -p "$OPENISD_HEAVY_GATE_DIR"

reserve_heavy_gate_slot() {
  local f pid active cores my_workers

  # This lock guards only the bookkeeping below (read the reservation dir, write our own file) —
  # a few milliseconds — never the heavy commands themselves. Runs are free to overlap fully.
  exec 9>"$OPENISD_HEAVY_GATE_ACCOUNTING_LOCK"
  flock 9

  # Reap reservations left by a run that no longer exists (crashed, killed, forgot to clean up —
  # otherwise a dead run throttles every run after it forever).
  for f in "$OPENISD_HEAVY_GATE_DIR"/*; do
    [ -e "$f" ] || continue
    pid="$(basename "$f")"
    kill -0 "$pid" 2>/dev/null || rm -f "$f"
  done

  active=0
  for f in "$OPENISD_HEAVY_GATE_DIR"/*; do
    [ -e "$f" ] || continue
    active=$((active + 1))
  done

  cores="$(nproc 2>/dev/null || echo 4)"
  my_workers=$((cores / (active + 1)))
  [ "$my_workers" -lt 1 ] && my_workers=1

  : > "$OPENISD_HEAVY_GATE_DIR/$$"
  exec 9>&-   # release the accounting lock — the run itself starts below, outside it

  export OPENISD_HEAVY_GATE_WORKERS="$my_workers"
  export OPENISD_TYPECHECK_CONCURRENCY="$my_workers"
  echo "[heavy-gate] $my_workers worker(s) this run ($active other heavy gate(s) active, $cores cores)"
}

release_heavy_gate_slot() {
  rm -f "$OPENISD_HEAVY_GATE_DIR/$$"
}
