#!/usr/bin/env bash
# A post-land run past POST_LAND_DEADLINE_S has its whole process group killed and is a red: its output
# says "post-land: TIMED OUT after <n>s at <sha>", an F task is pushed, no child survives, and
# ${POST_LAND_LOCK}.running is gone. Scratch repo, real git. Not a locked spec.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/post-land-timeout.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

cd "$SCRATCH" || exit 2
git init -q --bare -b main origin.git
git clone -q origin.git c 2>/dev/null; cd c || exit 2
git config user.email t@t; git config user.name t
mkdir -p scripts tasks/fixes; touch tasks/fixes/.keep
cp -r "$REPO/scripts/land" scripts/; cp "$REPO/scripts/paths.sh" scripts/
cat > suite.sh <<EOF2
#!/usr/bin/env bash
sleep 60 &
echo \$! > "$SCRATCH/childpid"
: > "$SCRATCH/started"
wait
EOF2
cat > land.conf <<EOF2
FULL_SUITE_CMD="bash suite.sh"
POST_LAND_LOCK="$SCRATCH/post.lock"
POST_LAND_DIR="$SCRATCH/copies"
POST_LAND_DEADLINE_S=2
EOF2
git add -A; git commit -qm base; git push -q origin main
sha=$(git rev-parse HEAD)
start=$SECONDS
timeout 60 bash scripts/land/post-land/run.sh "$sha" > "$SCRATCH/out" 2>&1; rc=$?
took=$((SECONDS - start))
child=$(cat "$SCRATCH/childpid" 2>/dev/null)
fx=$(git -C "$SCRATCH/origin.git" show main:tasks/fixes/F1.yml 2>/dev/null)

[ "$rc" = 1 ] && [ "$took" -lt 30 ] && ok "timed-out run ends red, quickly (rc=$rc ${took}s)" || fail "rc=$rc took=${took}s: $(cat "$SCRATCH/out")"
grep -q "post-land: TIMED OUT after [0-9]*s at $sha" "$SCRATCH/out" && ok "TIMED OUT line names the sha" || fail "no TIMED OUT line"
printf '%s' "$fx" | grep -q 'TIMED OUT' && ok "F task shows TIMED OUT" || fail "F task lacks TIMED OUT"
{ [ -n "$child" ] && ! kill -0 "$child" 2>/dev/null; } && ok "no sleep left in the group" || fail "sleep $child still alive"
[ ! -e "$SCRATCH/post.lock.running" ] && ok ".running removed" || fail ".running left behind"
[ ! -e "$SCRATCH/post.lock.green" ] && ok "not recorded green" || fail "recorded green"

[ $fails = 0 ] && { echo "post-land-timeout: all passed"; exit 0; }
echo "post-land-timeout: $fails failed"; exit 1
