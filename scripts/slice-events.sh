#!/usr/bin/env bash
# memory.events counters of a systemd user slice, for the post-land log.
#   . scripts/slice-events.sh; slice_events_line heavy.slice; slice_event_count heavy.slice high
# SLICE_CGROUP_ROOT replaces /sys/fs/cgroup/user.slice/user-<uid>.slice/user@<uid>.service in tests.
slice_events_file() {
  echo "${SLICE_CGROUP_ROOT:-/sys/fs/cgroup/user.slice/user-$(id -u).slice/user@$(id -u).service}/$1/memory.events"
}

slice_events_line() {
  local file; file="$(slice_events_file "$1")"
  if [ ! -r "$file" ]; then echo "slice $1 memory.events unreadable"; return; fi
  awk -v s="$1" 'BEGIN { printf "slice %s memory.events", s } { printf " %s=%s", $1, $2 } END { printf "\n" }' "$file"
}

# One counter, 0 where the file cannot be read.
slice_event_count() {
  awk -v k="$2" '$1 == k { print $2; found = 1 } END { if (!found) print 0 }' "$(slice_events_file "$1")" 2> /dev/null || echo 0
}
