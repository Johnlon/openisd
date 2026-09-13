#!/usr/bin/env bash
# Cross-process coordination for concurrent `npm test` runs (e.g. several coding agents running
# the UI suite at once). See bugs/BUG_20260913_oom_kills_wsl_vm_during_ui_tests.md "Still open".
#
# Runs are allowed to overlap — this does NOT serialize them. Only the ACCOUNTING is a critical
# section: read what's currently reserved, decide this run's worker count + port, record it,
# release the lock. Without that lock, two runs starting seconds apart both read the same
# "memory available" figure and can each pick a worker count that's safe alone but not together
# — the exact race that let the UI suite OOM-kill the whole WSL VM.
#
# Usage (from another script, not standalone):
#   source scripts/test-concurrency.sh
#   reserve_test_slot                  # sets OPENISD_TEST_WORKERS, OPENISD_TEST_PORT
#   trap release_test_slot EXIT        # caller must release when its run ends
#
# The reservation key is this shell's own PID ($$), so `release_test_slot` must run in the SAME
# shell process that called `reserve_test_slot` — sourcing (not exec-ing) this file into the
# caller's shell, as above, is what makes that true.

OPENISD_RESERVATION_DIR="${OPENISD_RESERVATION_DIR:-/tmp/openisd-ui-test-reservations}"
OPENISD_RESERVATION_LOCK="${OPENISD_RESERVATION_DIR}.lock"
OPENISD_PORT_POOL_START=4100
OPENISD_PORT_POOL_SIZE=8
# Same figures as playwright.config.js's MEM_PER_WORKER_GB / RESERVE_GB — see that file for how
# 0.7 was measured (PSS, not summed RSS). Kept independent rather than shared: this is bash,
# that's a Node config, and duplicating two numbers is cheaper than a cross-language config load.
OPENISD_MEM_PER_WORKER_GB="0.7"
OPENISD_RESERVE_GB="2"

mkdir -p "$OPENISD_RESERVATION_DIR"

reserve_test_slot() {
  local f pid w p mem_avail_gb reserved_gb nproc_val cpu_cap my_workers my_port i port_ok

  exec 9>"$OPENISD_RESERVATION_LOCK"
  flock 9   # blocks here if another run is mid-accounting; critical section starts now

  # Reap reservations left by runs that no longer exist (crashed, OOM-killed, forgot to clean up
  # — exactly the failure mode in BUG_20260913). Without this, a dead run's claim would
  # permanently throttle every run after it.
  for f in "$OPENISD_RESERVATION_DIR"/*; do
    [ -e "$f" ] || continue
    pid="$(basename "$f")"
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$f"
    fi
  done

  reserved_gb=0
  local used_ports=""
  for f in "$OPENISD_RESERVATION_DIR"/*; do
    [ -e "$f" ] || continue
    w="$(grep '^WORKERS=' "$f" 2>/dev/null | cut -d= -f2)"
    p="$(grep '^PORT=' "$f" 2>/dev/null | cut -d= -f2)"
    reserved_gb="$(awk -v a="$reserved_gb" -v w="${w:-0}" -v m="$OPENISD_MEM_PER_WORKER_GB" 'BEGIN { print a + w * m }')"
    used_ports="$used_ports $p"
  done

  if [ -r /proc/meminfo ]; then
    mem_avail_gb="$(awk '/^MemAvailable:/ { print $2 / 1024 / 1024 }' /proc/meminfo)"
  else
    mem_avail_gb=8   # non-Linux fallback (e.g. sourced under Git Bash on Windows)
  fi

  nproc_val="$(nproc)"
  cpu_cap=$(( (nproc_val + 1) / 2 ))   # ceiling division, matches playwright.config.js's Math.ceil(cpus/2)
  [ "$cpu_cap" -gt 8 ] && cpu_cap=8
  [ "$cpu_cap" -lt 1 ] && cpu_cap=1

  my_workers="$(awk -v avail="$mem_avail_gb" -v reserved="$reserved_gb" -v reserve="$OPENISD_RESERVE_GB" -v perw="$OPENISD_MEM_PER_WORKER_GB" 'BEGIN {
    budget = avail - reserve - reserved
    w = int(budget / perw)
    if (w < 1) w = 1
    print w
  }')"
  [ "$my_workers" -gt "$cpu_cap" ] && my_workers="$cpu_cap"

  my_port="$OPENISD_PORT_POOL_START"
  for ((i = 0; i < OPENISD_PORT_POOL_SIZE; i++)); do
    my_port=$((OPENISD_PORT_POOL_START + i))
    port_ok=1
    for p in $used_ports; do
      if [ "$p" = "$my_port" ]; then port_ok=0; break; fi
    done
    [ "$port_ok" -eq 1 ] && break
  done
  if [ "$port_ok" -ne 1 ]; then
    echo "WARNING: all $OPENISD_PORT_POOL_SIZE test ports in use by other concurrent runs — reusing $my_port, expect a collision" >&2
  fi

  {
    echo "WORKERS=$my_workers"
    echo "PORT=$my_port"
  } > "$OPENISD_RESERVATION_DIR/$$"

  exec 9>&-   # release the lock — critical section ends; the actual test run below overlaps freely

  export OPENISD_TEST_WORKERS="$my_workers"
  export OPENISD_TEST_PORT="$my_port"
  echo "test-concurrency: reserved $my_workers worker(s) on port $my_port (pid $$; ${reserved_gb}GB already claimed by other runs, ${mem_avail_gb}GB available)" >&2
}

release_test_slot() {
  rm -f "$OPENISD_RESERVATION_DIR/$$"
}
