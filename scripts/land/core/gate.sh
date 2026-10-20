#!/usr/bin/env bash
# One gate of a landing, fail closed on its own deadline. Sourced by scripts/land.sh.
#
# A gate that exits non-zero, or is still running at GATE_DEADLINE_S (0 = no deadline), refuses the landing. The gate
# runs under `timeout`, which gives it its own process group and kills the whole group at the
# deadline (TERM, then KILL 2 s later), so a hung gate leaves no process behind. The deadline starts after the
# gate is admitted (T487): a heavy gate first waits in scripts/budget.sh, outside `timeout`, for its memory and
# cores, so a busy machine never makes a gate overrun. If land.sh itself is stopped, gate_stop stops the
# running gate, or the wait for it, as one process group.

GATE_PID=""
GATE_OUT=""
# Timestamps (processes.md rule 8): every gate's output goes through the one logger.
GATE_TS_LOG="$(dirname "${BASH_SOURCE[0]}")/../../lib/ts-log.sh"
. "$GATE_TS_LOG"
GATE_TS_WRAP=(bash "$GATE_TS_LOG")
GATE_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# refuse <gate> <detail>: print what refused the landing and leave with exit 1.
refuse() {
  REFUSED="$1: $2"
  echo "land: REFUSED by gate $1: $2" >&2
  [ -s "$GATE_OUT" ] && tail -n 20 "$GATE_OUT" | sed 's/^/  | /' >&2
  exit 1
}

# run_gate <name> <stdin-file> <command> [args…]: the command string gets the args as "$@".
run_gate() {
  local name="$1" input="$2" cmd="$3" rc
  run_start "gate-$name"
  shift 3
  : > "$GATE_OUT"
  # What the gate costs; "none" for a command that is not heavy. Already admitted (BUDGET_HELD): not twice.
  local pool mb cores admit=()
  read -r pool mb cores < <(bash "$GATE_SCRIPTS/budget-cost.sh" "$cmd" "$@")
  if [ -z "${BUDGET_HELD:-}" ] && [ "${pool:-none}" != none ]; then
    admit=(bash "$GATE_SCRIPTS/budget.sh" "$pool" "$mb" --cpu "$cores" -- env BUDGET_HELD=1)
  fi
  # Its own session, so gate_stop reaches a gate that is still waiting for admission as well as a running one.
  setsid "${admit[@]}" timeout -k 2 "$GATE_DEADLINE_S" "${GATE_TS_WRAP[@]}" bash -c "$cmd \"\$@\"" gate "$@" < "$input" > "$GATE_OUT" 2>&1 &
  GATE_PID=$!
  wait "$GATE_PID"
  rc=$?
  GATE_PID=""
  run_end "gate-$name" "$rc"
  case "$rc" in
    0) return 0 ;;
    124|137) refuse "$name" "no result within its ${GATE_DEADLINE_S} s deadline; killed" ;;
    *) refuse "$name" "failed (exit $rc)" ;;
  esac
}

gate_stop() {
  [ -n "$GATE_PID" ] && { kill -TERM -- "-$GATE_PID" 2>/dev/null || kill -TERM "$GATE_PID" 2>/dev/null; }
  return 0
}
