#!/bin/sh
# Machine-wide FIFO queue for slow runs: only one slow run on this machine at a time.
#
# John, 2026-10-07: concurrent slow runs kill the machine. A slow run is the openisd pre-commit
# gate, the pre-push suite, scripts/health-check.sh, a full vitest/playwright run, or a
# winisd_tools corpus run started with `heavy.sh --slow`. All of them, from every repo and every
# session, share ONE queue directory. The second slow run waits its turn and prints one line
# naming what it waits behind. Targeted runs (`bash scripts/test.sh <spec>`) never come here.
#
# Source it, then:
#
#   slow_queue_enter "pre-push abc1234"   # returns when this shell is at the head of the queue
#   ...the slow work...
#   slow_queue_leave
#
# Each waiter holds a numbered ticket file. The head of the queue is the lowest ticket whose
# process is still alive, so a run that crashes or is killed leaves the queue by dying: no stale
# lock to delete by hand. A ticket names its process by pid AND start time, so a recycled pid
# does not keep a dead ticket alive. The ticket belongs to this shell ($$); `exec` keeps the pid,
# so `slow_queue_enter; exec cmd` holds the queue until cmd exits.
#
# Nested slow runs (pre-push holds the queue and calls a full browser run that also queues) pass
# straight through: SLOW_RUN_TICKET is exported to children, and a live ticket there means the
# caller already holds the queue.
#
# Env: SLOW_RUN_DIR (default /tmp/slow-run-queue, shared by every repo on the machine),
# SLOW_RUN_OWNER (who to name in the waiting line; default user@repo), SLOW_RUN_POLL_S (2).

SLOW_RUN_DIR="${SLOW_RUN_DIR:-/tmp/slow-run-queue}"

# Start time of a process in clock ticks since boot (field 22 of /proc/<pid>/stat). The fields
# after the ")" that closes the command name start at field 3, so field 22 is the 20th of them.
slow_queue_pstart() {
  sed 's/.*) //' "/proc/$1/stat" 2>/dev/null | cut -d' ' -f20
}

slow_queue_field() {
  sed -n "s/^$2=//p" "$1" 2>/dev/null | head -n 1
}

# True when the process that wrote ticket $1 is still running.
slow_queue_ticket_alive() {
  _sq_pid="$(slow_queue_field "$1" pid)"
  [ -n "$_sq_pid" ] || return 1
  [ "$(slow_queue_pstart "$_sq_pid")" = "$(slow_queue_field "$1" pstart)" ]
}

# Remove the tickets of runs that no longer exist.
slow_queue_reap() {
  for _sq_t in "$SLOW_RUN_DIR"/q/*; do
    [ -e "$_sq_t" ] || continue
    slow_queue_ticket_alive "$_sq_t" || rm -f "$_sq_t"
  done
}

slow_queue_head() {
  for _sq_t in "$SLOW_RUN_DIR"/q/*; do
    [ -e "$_sq_t" ] || continue
    echo "$_sq_t"
    return 0
  done
  return 0
}

slow_queue_enter() {
  _sq_label="$1"
  SLOW_QUEUE_NESTED=0
  if [ -n "${SLOW_RUN_TICKET:-}" ] && slow_queue_ticket_alive "$SLOW_RUN_TICKET"; then
    SLOW_QUEUE_NESTED=1   # the caller already holds the queue
    return 0
  fi
  mkdir -p "$SLOW_RUN_DIR/q"
  (
    flock 8
    _sq_seq=$(( $(cat "$SLOW_RUN_DIR/seq" 2>/dev/null || echo 0) + 1 ))
    echo "$_sq_seq" > "$SLOW_RUN_DIR/seq"
    _sq_ticket="$SLOW_RUN_DIR/q/$(printf '%012d' "$_sq_seq")"
    {
      echo "pid=$$"
      echo "pstart=$(slow_queue_pstart $$)"
      echo "owner=${SLOW_RUN_OWNER:-${USER:-?}@$(basename "$PWD") pid $$}"
      echo "cmd=$_sq_label"
      echo "queued=$(date '+%Y-%m-%d %H:%M:%S')"
    } > "$_sq_ticket.tmp"
    mv "$_sq_ticket.tmp" "$_sq_ticket"
    echo "$_sq_ticket" > "$SLOW_RUN_DIR/last.$$"
  ) 8>"$SLOW_RUN_DIR/seq.lock"
  SLOW_RUN_TICKET="$(cat "$SLOW_RUN_DIR/last.$$")"
  rm -f "$SLOW_RUN_DIR/last.$$"
  export SLOW_RUN_TICKET

  _sq_shown=""
  while :; do
    slow_queue_reap
    _sq_head="$(slow_queue_head)"
    [ "$_sq_head" = "$SLOW_RUN_TICKET" ] && break
    if [ "$_sq_head" != "$_sq_shown" ] && [ -n "$_sq_head" ]; then
      _sq_ahead=0
      for _sq_t in "$SLOW_RUN_DIR"/q/*; do
        [ "$_sq_t" = "$SLOW_RUN_TICKET" ] && break
        _sq_ahead=$((_sq_ahead + 1))
      done
      _sq_since="$(slow_queue_field "$_sq_head" started)"
      echo "[slow-run] queued: waiting behind $(slow_queue_field "$_sq_head" owner): $(slow_queue_field "$_sq_head" cmd), running since ${_sq_since:-just now} ($_sq_ahead ahead)" >&2
      _sq_shown="$_sq_head"
    fi
    sleep "${SLOW_RUN_POLL_S:-2}"
  done
  echo "started=$(date '+%Y-%m-%d %H:%M:%S')" >> "$SLOW_RUN_TICKET"
}

slow_queue_leave() {
  [ "${SLOW_QUEUE_NESTED:-0}" = "1" ] && return 0
  [ -n "${SLOW_RUN_TICKET:-}" ] && rm -f "$SLOW_RUN_TICKET"
  SLOW_RUN_TICKET=""
}
