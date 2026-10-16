#!/usr/bin/env bash
# A browser run's record, and how a run whose owner is gone is stopped. Sourced by
# scripts/test-concurrency.sh (writes the record), scripts/housekeeping.sh and
# scripts/land/post-land/run.sh (stop runs).
#
# One file per browser run in $OPENISD_RESERVATION_DIR, named by the run's pid. scripts/test-browser.sh
# re-execs into its own process group with setsid, so that pid is also the run's process group. Lines:
#   WORKERS, PORT    the slot (scripts/test-concurrency.sh)
#   GROUP_START      start time of the group leader, so a reused pid is never taken for the run
#   OWNER            "<pid> <start>" of the run this browser run belongs to: OPENISD_BROWSER_OWNER when
#                    set (post-land/run.sh exports its own), else the process that started test-browser.sh
#
# Why the owner: the setsid that lets a browser run kill its own children also takes it out of its
# caller's process group, so a caller that stops by group (post-land's stop_suite) misses it. On 16 Oct
# 2026 a post-land run was killed and its browser run (pid 1231545) lived on for 93 min with init as its
# parent, holding the browser lock that the next suite and every spec run waited on. Its own pid was
# alive, so judging by that pid kept it; judging by its owner frees it.

# shellcheck source=admit/record.sh
. "$(dirname "${BASH_SOURCE[0]}")/admit/record.sh"

browser_run_field() { # browser_run_field <record> <key>
  sed -n "s/^$2=//p" "$1" 2> /dev/null | head -1
}

# Prints why the record's owner is gone and returns 0; returns 1 when the owner is alive or the record
# names none (written before owners were recorded: left to the pid check in test-concurrency.sh).
browser_run_owner_gone() { # browser_run_owner_gone <record>
  local owner pid start now
  owner=$(browser_run_field "$1" OWNER)
  [ -n "$owner" ] || return 1
  read -r pid start <<< "$owner"
  [ -n "${pid:-}" ] || return 1
  now=$(admit_starttime "$pid")
  if [ -z "$now" ]; then echo "owner pid $pid is dead"; return 0; fi
  [ -n "${start:-}" ] && [ "$now" != "$start" ] && { echo "owner pid $pid was reused by another process"; return 0; }
  return 1
}

# Stops the run's process group (TERM, then KILL after 5 s) and removes its record. The group is
# signalled only while its leader is the process the record names (same start time): a group whose
# leader has gone and whose pid was reused is never touched.
browser_run_stop() { # browser_run_stop <record>
  local group start
  group=$(basename "$1")
  start=$(browser_run_field "$1" GROUP_START)
  if [ -n "$start" ] && [ "$(admit_starttime "$group")" = "$start" ]; then
    kill -TERM -- "-$group" 2> /dev/null || true
    timeout 5 tail --pid="$group" -f /dev/null 2> /dev/null || true
    kill -KILL -- "-$group" 2> /dev/null || true
  fi
  rm -f -- "$1"
}

# Stops every browser run whose OWNER is the given process. post-land/run.sh calls it with its own pid
# when it stops its suite.
browser_runs_stop_owned_by() { # browser_runs_stop_owned_by <pid>
  local rec owner
  for rec in "$OPENISD_RESERVATION_DIR"/*; do
    [ -f "$rec" ] || continue
    owner=$(browser_run_field "$rec" OWNER)
    [ "${owner%% *}" = "$1" ] || continue
    echo "post-land: stopping browser run $(basename "$rec") (owner pid $1 is ending)"
    browser_run_stop "$rec"
  done
}
