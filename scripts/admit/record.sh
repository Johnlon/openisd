#!/usr/bin/env bash
# The admission slot's on-disk format, shared by scripts/admit.sh and scripts/housekeeping.sh.
#
#   $ADMIT_DIR (default /tmp/openisd-admit)
#     next.lock        flock'ed while a ticket is taken
#     next             the last ticket number handed out
#     q/<number>.rec   one file per admitted-or-waiting job, number = 8 digits, FIFO by number
#
# A .rec is plain `key=value` lines: pid, start (field 22 of /proc/<pid>/stat), label, run, queued
# (epoch seconds). Its OWNER (the admit.sh process) holds an exclusive flock on the file for as
# long as it lives, and does not pass that descriptor to the job it runs. The kernel drops the lock
# when the owner dies, however it dies. So:
#   - a record whose lock can be taken has a dead owner (admit_owner_dead);
#   - the job holding the slot is the lowest-numbered record whose owner is alive;
#   - a waiter is first when no lower-numbered record has a live owner.
# scripts/housekeeping.sh removes the records of dead owners and logs each one.

admit_dir() { printf '%s\n' "${ADMIT_DIR:-/tmp/openisd-admit}"; }

admit_field() { # admit_field <rec-file> <key>
  sed -n "s/^$2=//p" "$1" 2> /dev/null | head -1
}

admit_starttime() { # admit_starttime <pid>: field 22 of /proc/<pid>/stat, empty when the pid is gone
  local stat
  stat=$(cat "/proc/$1/stat" 2> /dev/null) || return 0
  stat=${stat##*) }
  set -- $stat
  printf '%s\n' "${20}"
}

admit_owner_dead() { # true when nobody holds the record's lock
  [ -e "$1" ] || return 0
  flock -n "$1" true 2> /dev/null
}
