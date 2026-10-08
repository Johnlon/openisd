#!/usr/bin/env bash
# One gate of a landing, fail closed on its own deadline. Sourced by scripts/land.sh.
#
# A gate that exits non-zero, or is still running at GATE_DEADLINE_S, refuses the landing. The gate
# runs under `timeout`, which gives it its own process group and kills the whole group at the
# deadline (TERM, then KILL 2 s later), so a hung gate leaves no process behind. If land.sh itself
# is stopped, gate_stop passes the stop to the running gate.

GATE_PID=""
GATE_OUT=""

# refuse <gate> <detail>: print what refused the landing and leave with exit 1.
refuse() {
  echo "land: REFUSED by gate $1: $2" >&2
  [ -s "$GATE_OUT" ] && tail -n 20 "$GATE_OUT" | sed 's/^/  | /' >&2
  exit 1
}

# run_gate <name> <stdin-file> <command> [args…]: the command string gets the args as "$@".
run_gate() {
  local name="$1" input="$2" cmd="$3" rc
  shift 3
  : > "$GATE_OUT"
  timeout -k 2 "$GATE_DEADLINE_S" bash -c "$cmd \"\$@\"" gate "$@" < "$input" > "$GATE_OUT" 2>&1 &
  GATE_PID=$!
  wait "$GATE_PID"
  rc=$?
  GATE_PID=""
  case "$rc" in
    0) return 0 ;;
    124|137) refuse "$name" "no result within its ${GATE_DEADLINE_S} s deadline; killed" ;;
    *) refuse "$name" "failed (exit $rc)" ;;
  esac
}

gate_stop() {
  [ -n "$GATE_PID" ] && kill -TERM "$GATE_PID" 2>/dev/null
  return 0
}
