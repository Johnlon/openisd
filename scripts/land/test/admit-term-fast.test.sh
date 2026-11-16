#!/usr/bin/env bash
# TERM to an admitted run whose job dies at once on TERM ends admit.sh at once, not after the 10 s KILL
# timer. T819: stop_job_group waited with `wait -n` on the job and a timer; when the job died and was
# reaped before `wait -n` began, bash no longer listed it and the wait ran out the whole timer. On a loaded
# runner that made admit-term-group.test.sh see members alive 10 s after TERM.
# Made deterministic here: a DEBUG trap (BASH_ENV, inherited by admit.sh) holds up the wait or timer
# commands 0.5 s, so the job is always dead and reaped before they run.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/admit-term-fast.XXXXXX")"
export ADMIT_DIR="$SCRATCH/admit"
trap 'rm -rf "$SCRATCH"' EXIT
cat > "$SCRATCH/delay.sh" <<'D'
set -T
trap 'case "$BASH_COMMAND" in "wait -n"*|"timeout "*|"sleep 10"*) /bin/sleep 0.5;; esac' DEBUG
D
cat > "$SCRATCH/job.sh" <<'J'
#!/usr/bin/env bash
echo up > "$(dirname "$0")/up"
exec sleep 60
J
BASH_ENV="$SCRATCH/delay.sh" setsid bash "$REPO/scripts/admit.sh" suite -- bash "$SCRATCH/job.sh" > "$SCRATCH/out" 2>&1 &
pid=$!
for _ in $(seq 50); do [ -e "$SCRATCH/up" ] && break; sleep 0.1; done
[ -e "$SCRATCH/up" ] || { echo "FAIL job never started"; cat "$SCRATCH/out"; exit 1; }
start=$SECONDS
kill -TERM "$pid"
while kill -0 "$pid" 2> /dev/null && [ $((SECONDS - start)) -lt 8 ]; do sleep 0.1; done
took=$((SECONDS - start))
if kill -0 "$pid" 2> /dev/null; then
  echo "FAIL admit.sh still running ${took}s after TERM (job already dead)"; kill -KILL -- "-$pid" 2> /dev/null; exit 1
fi
[ "$took" -lt 5 ] && echo "ok   admit.sh ended ${took}s after TERM" || { echo "FAIL admit.sh took ${took}s"; exit 1; }
