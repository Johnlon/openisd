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
# worker threads, THIS run should use. Also sets OPENISD_HEAVY_GATE_TEST_TIMEOUT.
#
# Peer-count fair share alone is not enough: it only sees sessions that also source this script.
# A session running tsc/vitest by hand, wine/build work, or anything else on the box adds real
# contention this script never hears about — observed 2026-09-26, a run that reserved 10/10
# workers ("0 other heavy gate(s) active") still timed out under real ambient load. So both
# numbers also read the box's actual 1-minute load average (/proc/loadavg) and react to whichever
# signal — peer count or real load — says the box is busier. Fewer workers/longer timeout is
# never wrong; assuming the box is idle when it is not, is.
#
# The timeout multiplier is NOT a linear load/cores ratio — that model failed in practice
# (2026-09-26, calc-bug: two architecture tests timed out at 5.1-5.3s under load 8-12 on 10
# cores, a load/cores ratio below 1.0 that a linear model leaves unscaled, even though the same
# tests take under 2s run alone). The real mechanism is ~/.config/systemd/user/heavy.slice's
# CPUWeight=20 versus the systemd default of 100: the instant ANYTHING outside heavy.slice wants
# CPU, this slice is throttled to roughly 20/100 of its fair share — a fixed ~5x penalty set by
# that weight ratio, not something that scales gradually with how high load climbs. So the rule
# is binary: any real contention (load above a small idle floor) applies the full CPU_WEIGHT_RATIO
# penalty to the timeout, on top of the worker-count scaling.

OPENISD_HEAVY_GATE_DIR="${OPENISD_HEAVY_GATE_DIR:-/tmp/openisd-heavy-gate-reservations}"
OPENISD_HEAVY_GATE_ACCOUNTING_LOCK="${OPENISD_HEAVY_GATE_DIR}.lock"
mkdir -p "$OPENISD_HEAVY_GATE_DIR"

reserve_heavy_gate_slot() {
  local f pid active cores my_workers my_timeout load1 load_centi cores_centi load_workers

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

  # Real load average, independent of who else is registered here. load_centi/cores_centi are
  # both *100 so this stays integer arithmetic (dash has no floating point).
  if [ -r /proc/loadavg ]; then
    load1="$(cut -d' ' -f1 /proc/loadavg)"
    load_centi="$(printf '%s' "$load1" | awk '{printf "%d", $1 * 100}')"
    cores_centi=$((cores * 100))
    if [ "$load_centi" -gt "$cores_centi" ]; then
      load_workers=$((cores_centi * cores / load_centi))
      [ "$load_workers" -lt 1 ] && load_workers=1
      [ "$load_workers" -lt "$my_workers" ] && my_workers="$load_workers"
    fi
  else
    load_centi="$((cores * 100))"
    cores_centi="$((cores * 100))"
  fi

  # Timeout scales with worker-count shrinkage (peer count, real load, or both), then applies the
  # fixed heavy.slice CPUWeight penalty (20 vs the default 100 = 5x) whenever there is ANY real
  # contention — load above a small idle floor, not only once load exceeds core count.
  CPU_WEIGHT_RATIO=5
  IDLE_LOAD_CENTI=100
  my_timeout=$((5000 * cores / my_workers))
  [ "$load_centi" -gt "$IDLE_LOAD_CENTI" ] && my_timeout=$((my_timeout * CPU_WEIGHT_RATIO))
  [ "$my_timeout" -gt 30000 ] && my_timeout=30000

  : > "$OPENISD_HEAVY_GATE_DIR/$$"
  exec 9>&-   # release the accounting lock — the run itself starts below, outside it

  export OPENISD_HEAVY_GATE_WORKERS="$my_workers"
  export OPENISD_TYPECHECK_CONCURRENCY="$my_workers"
  export OPENISD_HEAVY_GATE_TEST_TIMEOUT="$my_timeout"
  echo "[heavy-gate] $my_workers worker(s), ${my_timeout}ms test timeout this run ($active other heavy gate(s) active, $cores cores)"
}

release_heavy_gate_slot() {
  rm -f "$OPENISD_HEAVY_GATE_DIR/$$"
}
