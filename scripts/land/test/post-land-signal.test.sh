#!/usr/bin/env bash
# A post-land run that gets a TERM with no newer run behind it is a red that says so: its output reads
# "post-land: killed by signal at <sha>", an F task is pushed, no child survives, and
# the sha is recorded as tested. A TERM is a red even with a newer run waiting: nothing kills a running suite on purpose. Scratch repo,
# real git, real processes. Not a locked spec.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
export POST_LAND_QUIET_S=0   # the quiet period is tested in post-land-queue.test.sh
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/post-land-signal.XXXXXX")"
RUNPID=""
fails=0
cleanup() { [ -n "$RUNPID" ] && kill -KILL -- "-$RUNPID" 2>/dev/null; rm -rf "$SCRATCH" "$GITCFG"; }
trap cleanup EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

cd "$SCRATCH" || exit 2
git init -q --bare -b main origin.git
git clone -q origin.git c 2>/dev/null; cd c || exit 2
git config user.email t@t; git config user.name t
mkdir -p scripts tasks/fixes; touch tasks/fixes/.keep
cp -r "$REPO/scripts/land" scripts/; cp "$REPO/scripts/paths.sh" "$REPO/scripts/suite-lock.sh" scripts/
cat > suite.sh <<EOF2
#!/usr/bin/env bash
sleep 120 &
echo \$! > "$SCRATCH/childpid"
: > "$SCRATCH/started"
wait
EOF2
cat > land.conf <<EOF2
FULL_SUITE_CMD="bash suite.sh"
POST_LAND_LOCK="$SCRATCH/post.lock"
POST_LAND_DIR="$SCRATCH/copies"
POST_LAND_DEADLINE_S=300
EOF2
git add -A; git commit -qm base; git push -q origin main
sha=$(git rev-parse HEAD)

# 1. A bare TERM (the OOM case): red, truthful line, F task, child gone, recorded tested
setsid bash scripts/land/post-land/run.sh "$sha" > "$SCRATCH/out" 2>&1 & RUNPID=$!
for _ in $(seq 1 200); do [ -e "$SCRATCH/started" ] && break; sleep 0.1; done
[ -e "$SCRATCH/started" ] || { fail "suite never started: $(cat "$SCRATCH/out")"; exit 1; }
kill -TERM "$RUNPID"
wait "$RUNPID" 2>/dev/null; rc=$?
RUNPID=""
child=$(cat "$SCRATCH/childpid" 2>/dev/null)
fx=$(git -C "$SCRATCH/origin.git" show main:tasks/fixes/F1.yml 2>/dev/null)
[ "$rc" = 1 ] && ok "run ends red (rc=$rc)" || fail "rc=$rc: $(cat "$SCRATCH/out")"
grep -q "post-land: killed by signal at ${sha:0:10}" "$SCRATCH/out" && ok "says it was killed by a signal" || fail "no signal line: $(cat "$SCRATCH/out")"
if grep -q "post-land: superseded" "$SCRATCH/out"; then fail "called itself superseded"; else ok "does not call itself superseded"; fi
printf '%s' "$fx" | grep -q 'killed by signal' && ok "F task names the signal" || fail "F task: $fx"
{ [ -n "$child" ] && ! kill -0 "$child" 2>/dev/null; } && ok "no sleep left in the group" || fail "sleep $child still alive"
[ ! -e "$SCRATCH/post.lock.running" ] && ok ".running removed" || fail ".running left behind"
[ "$(cat "$SCRATCH/post.lock.tested" 2>/dev/null)" = "$sha" ] && ok "sha recorded as tested" || fail "tested not recorded"
[ ! -e "$SCRATCH/post.lock.green" ] && ok "not recorded green" || fail "recorded green"

# 2. A TERM with a newer run waiting is still a red: no run kills another any more, so a TERM is the
#    machine's or a person's, and it is reported as what it was
rm -f "$SCRATCH/started" "$SCRATCH/out" "$SCRATCH/post.lock.tested"
mkdir -p "$SCRATCH/post.lock.pending"; exec 6> "$SCRATCH/post.lock.pending/9999999999999999999-newer0123"; flock -n 6
setsid bash scripts/land/post-land/run.sh "$sha" > "$SCRATCH/out" 2>&1 & RUNPID=$!
for _ in $(seq 1 200); do [ -e "$SCRATCH/started" ] && break; sleep 0.1; done
kill -TERM "$RUNPID"
wait "$RUNPID" 2>/dev/null; rc=$?
RUNPID=""
exec 6>&-; rm -f "$SCRATCH/post.lock.pending/9999999999999999999-newer0123"
[ "$rc" = 1 ] && grep -q "post-land: killed by signal at ${sha:0:10}" "$SCRATCH/out" && ! grep -q "superseded" "$SCRATCH/out" && ok "a TERM with a newer run waiting is a red, not a supersede" || fail "rc=$rc: $(cat "$SCRATCH/out")"

# 3. A TERM while the suite is still waiting for the browser lock: no red, no F, nothing tested
rm -f "$SCRATCH/started" "$SCRATCH/out" "$SCRATCH/post.lock.tested" "$SCRATCH/post.lock.supersede"
export SUITE_RUN_LOCK="$SCRATCH/suite-run.lock"
cat > suite.sh <<EOF2
#!/usr/bin/env bash
bash "$PWD/scripts/suite-lock.sh" exclusive -- bash -c ': > "$SCRATCH/started"; sleep 120'
EOF2
git add -A; git commit -qm suite2; git pull -q --rebase origin main 2>/dev/null; git push -q origin main; sha2=$(git rev-parse HEAD)
( exec 9> "$SUITE_RUN_LOCK"; flock -s 9; exec sleep 120 ) & HOLD=$!
sleep 0.5
setsid bash scripts/land/post-land/run.sh "$sha2" > "$SCRATCH/out" 2>&1 & RUNPID=$!
for _ in $(seq 1 100); do [ -s "$SUITE_RUN_LOCK.waiting" ] && break; sleep 0.1; done
[ -s "$SUITE_RUN_LOCK.waiting" ] && ok "the waiting suite records that it waits" || fail "no waiting record: $(cat "$SCRATCH/out")"
kill -TERM "$RUNPID"
wait "$RUNPID" 2>/dev/null; rc=$?
RUNPID=""
kill -KILL "$HOLD" 2>/dev/null
[ "$rc" = 0 ] && grep -q "killed while waiting for the browser lock at ${sha2:0:10}" "$SCRATCH/out" && ok "a kill while waiting is no result" || fail "rc=$rc: $(cat "$SCRATCH/out")"
git -C "$SCRATCH/origin.git" show main:tasks/fixes/F2.yml > /dev/null 2>&1 && fail "pushed an F for a run killed while waiting" || ok "no F pushed for a run killed while waiting"
[ ! -e "$SCRATCH/post.lock.tested" ] && ok "nothing recorded as tested" || fail "recorded tested"
[ ! -e "$SUITE_RUN_LOCK.waiting" ] && ok "waiting record removed" || fail "waiting record left behind"

[ $fails = 0 ] && { echo "post-land-signal: all passed"; exit 0; }
echo "post-land-signal: $fails failed"; exit 1
