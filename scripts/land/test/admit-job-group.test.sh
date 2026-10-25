#!/usr/bin/env bash
# admit.sh runs its job in its own group and kills the whole group on TERM, INT or HUP, before it frees
# the slot: grandchildren die too (including one that ignores TERM). T488.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/admit-job-group.XXXXXX")"
export ADMIT_DIR="$SCRATCH/admit"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0; ok() { echo "ok   $1"; }; fail() { echo "FAIL $1"; fails=$((fails + 1)); }
cat > "$SCRATCH/job.sh" <<'JOB'
#!/usr/bin/env bash
bash -c 'trap "" TERM; sleep 300 & echo $! >> "$PIDS"; wait' &
sleep 300 &
echo $! >> "$PIDS"
wait
JOB
alive() { local n=0 p; for p in $(cat "$PIDS" 2> /dev/null); do kill -0 "$p" 2> /dev/null && n=$((n + 1)); done; echo "$n"; }
export PIDS="$SCRATCH/pids"
# INT is not tested: a non-interactive shell starts background jobs with INT ignored; a tty sends it to the group.
for sig in TERM HUP; do
  : > "$PIDS"; rm -rf "$ADMIT_DIR" "$ADMIT_DIR.holder"
  bash "$REPO/scripts/admit.sh" job -- bash "$SCRATCH/job.sh" > "$SCRATCH/out" 2>&1 & w=$!
  sleep 2
  [ "$(alive)" = 2 ] && ok "$sig: job tree running" || fail "$sig: job tree not running ($(alive))"
  kill -"$sig" "$w"; wait "$w" 2> /dev/null
  sleep 0.5
  [ "$(alive)" = 0 ] && ok "$sig to admit.sh: grandchildren dead" || fail "$sig to admit.sh: $(alive) grandchildren alive"
  [ -z "$(ls "$ADMIT_DIR"/q 2> /dev/null)" ] && [ ! -e "$ADMIT_DIR.holder" ] && ok "$sig: slot freed" || fail "$sig: slot or holder left"
  for p in $(cat "$PIDS"); do kill -KILL "$p" 2> /dev/null; done
done
[ "$fails" = 0 ] && { echo "admit-job-group: all passed"; exit 0; }
exit 1
