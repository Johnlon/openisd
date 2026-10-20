#!/usr/bin/env bash
# `kill -TERM -<pgid>` on an admitted run stops the whole group, admit.sh and every descendant,
# and frees the slot. T042.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/admit-term.XXXXXX")"
export ADMIT_DIR="$SCRATCH/admit"
fails=0
trap 'rm -rf "$SCRATCH"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# admit.sh runs the job in its own group (T488), whose leader pid job.sh writes to $SCRATCH/jobpg: count both groups.
group_size() { ps -eo pgid= | awk -v g="$1" -v j="$(cat "$SCRATCH/jobpg" 2>/dev/null)" '$1==g || $1==j' | wc -l; }

# A job shaped like the post-land suite: a shell that starts a background job and waits on it, as
# `npx vitest run || unit=$?` does, with a descendant that takes a second to handle TERM.
cat > "$SCRATCH/job.sh" <<'JOB'
#!/usr/bin/env bash
echo $$ > "$(dirname "$0")/jobpg"
bash -c 'trap "sleep 1; exit 0" TERM; while :; do sleep 1; done' &
inner=$!
wait "$inner"
JOB

# setsid makes the run a session and group leader: its pid is its pgid.
setsid bash "$REPO/scripts/admit.sh" suite -- bash "$SCRATCH/job.sh" > "$SCRATCH/out" 2>&1 &
pgid=$!
sleep 2
before=$(group_size "$pgid")
[ "$before" -ge 3 ] && ok "group has $before members" || fail "group has only $before members"

kill -TERM -- "-$pgid"
left=$before
for _ in 1 2 3 4 5 6 7 8 9 10; do
  left=$(group_size "$pgid")
  [ "$left" = 0 ] && break
  sleep 1
done
[ "$left" = 0 ] && ok "TERM to the group stopped every member" || fail "$left members still alive 10 s after TERM"
if [ -z "$(ls "$ADMIT_DIR"/q 2>/dev/null)" ]; then ok "slot freed"; else fail "slot record left behind"; fi
exit "$fails"
