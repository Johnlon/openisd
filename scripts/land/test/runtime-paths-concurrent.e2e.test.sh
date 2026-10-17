#!/usr/bin/env bash
# Concurrent runtime paths test: two land.sh + two post-land runs in a scratch repo
# with isolated XDG_RUNTIME_DIR. Verifies locks/queues use $OPENISD_RUNTIME_DIR,
# serialization works, and no legacy /tmp/openisd-* paths are created.
set -uo pipefail

# Independent git config
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
export POST_LAND_QUIET_S=0   # the quiet period is tested in post-land-queue.test.sh

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Scratch repo with isolated XDG_RUNTIME_DIR
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/runtime-concurrent.XXXXXX")"
export XDG_RUNTIME_DIR="$SCRATCH/xdg"
mkdir -p "$XDG_RUNTIME_DIR"
export OPENISD_RUNTIME_DIR="$XDG_RUNTIME_DIR/openisd"
fails=0

# Clean up any pre-existing legacy paths so we can detect new ones created by our runs
for f in /tmp/openisd-land.lock /tmp/openisd-post-land.lock /tmp/openisd-admit /tmp/openisd-heavy-gate-reservations /tmp/openisd-ui-test-reservations; do
    rm -rf "$f" 2>/dev/null || true
done

trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT

ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

setup_repo() {
    local with_suite=${1:-true}
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git seed 2>/dev/null; cd seed || exit 2
    git config user.email t@t; git config user.name t
    mkdir -p scripts tasks/fixes gates
    cp "$REPO/scripts/land.sh" scripts/
    cp -r "$REPO/scripts/land" scripts/; cp -r "$REPO/scripts/lib" scripts/
    cp "$REPO/scripts/paths.sh" scripts/
    cp "$REPO/scripts/browser-runs.sh" scripts/; cp -r "$REPO/scripts/admit" scripts/
    cat > gates/lint.sh <<'EOF'
#!/usr/bin/env bash
echo "lint_start" >> "$LANDING_LOG/seq"
printf '%s\n' "$@" > "$GATE_LOG/lint.args"
[ -f "$GATE_LOG/lint.fail" ] && exit 1
echo "lint_end" >> "$LANDING_LOG/seq"
exit 0
EOF
    cat > gates/typecheck.sh <<'EOF'
#!/usr/bin/env bash
echo "typecheck_start" >> "$LANDING_LOG/seq"
[ -f "$GATE_LOG/typecheck.fail" ] && exit 1
echo "typecheck_end" >> "$LANDING_LOG/seq"
exit 0
EOF
    cat > gates/attribution.sh <<'EOF'
#!/usr/bin/env bash
echo "attribution_start" >> "$LANDING_LOG/seq"
! grep -qi '^co-authored-by:.*claude'
echo "attribution_end" >> "$LANDING_LOG/seq"
EOF
    # land.sh refuses a repo with no UNIT_CMD; this gate logs nothing, so the sequence checks stay as they were.
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/unit.sh
    chmod +x gates/*.sh
    if [ "$with_suite" = "true" ]; then
        suite_line='FULL_SUITE_CMD="bash suite.sh"'
    else
        suite_line='# FULL_SUITE_CMD not set'
    fi
    cat > land.conf <<EOF
LINT_CMD="bash gates/lint.sh"
TYPECHECK_CMD="bash gates/typecheck.sh"
UNIT_CMD="bash gates/unit.sh"
ARCHITECTURE_CMD="true"
ATTRIBUTION_CMD="bash gates/attribution.sh"
GATE_DEADLINE_S=5
LAND_LOCK="$OPENISD_RUNTIME_DIR/land.lock"
$suite_line
POST_LAND_LOCK="$OPENISD_RUNTIME_DIR/post-land.lock"
POST_LAND_DIR="$SCRATCH/copies"
EOF
    if [ "$with_suite" = "true" ]; then
        cat > suite.sh <<'EOF'
#!/usr/bin/env bash
pwd > "$SUITE_LOG/cwd.$$"
echo start >> "$SUITE_LOG/seq"
trap 'echo end >> "$SUITE_LOG/seq"' EXIT
# ENTERED signal: when the test made a fifo, tell it the suite is running, then stay in the suite
# long enough for a second run to contend for the lock.
if [ -p "$SUITE_LOG/entered.fifo" ]; then
    echo up > "$SUITE_LOG/entered.fifo"
    sleep 3
fi
[ -f FAIL ] && { echo "spec broken.spec.ts failed"; exit 1; }
date +%s%N >> "$SUITE_LOG/runs"; exit 0
EOF
        chmod +x suite.sh
    fi
    touch tasks/.keep tasks/fixes/.keep
    echo base > a.txt; echo base > b.txt; echo spec > spec.sh
    git add -A; git commit -qm base; git push -q origin main
    cd ..
    for w in w1 w2; do git clone -q origin.git $w; git -C $w config user.email t@t; git -C $w config user.name t; done
    export GATE_LOG="$SCRATCH/gatelog"; rm -rf "$GATE_LOG"; mkdir -p "$GATE_LOG"
    export SUITE_LOG="$SCRATCH/suitelog"; rm -rf "$SUITE_LOG"; mkdir -p "$SUITE_LOG"
    export LANDING_LOG="$SCRATCH/landinglog"; rm -rf "$LANDING_LOG"; mkdir -p "$LANDING_LOG"
}

task() {
    local c=$1 id=$2 glob=$3 dt=${4:-true} label=${5:-}
    local h; h=$(sha256sum "$SCRATCH/w/$c/spec.sh" | cut -d' ' -f1)
    cat > "$SCRATCH/w/$c/tasks/$id.yml" <<EOF
id: $id
owner: test
status: claimed
goal: test task
done_test: $dt
locked:
  - path: spec.sh
    sha256: $h
files:
  - $glob
${label:+label: $label}
EOF
    git -C "$SCRATCH/w/$c" add "tasks/$id.yml"; git -C "$SCRATCH/w/$c" commit -qm "task $id"
}
edit() { echo "$3" >> "$SCRATCH/w/$1/$2"; }
land() { (cd "$SCRATCH/w/$1" && timeout 120 bash scripts/land.sh "$2" >"$SCRATCH/out.$1" 2>&1); }
post() { timeout 120 bash scripts/land/post-land/run.sh "$1" > "$SCRATCH/post-out.$2" 2>&1; }
origin_head() { git -C "$SCRATCH/w/origin.git" rev-parse main; }
green() { cat "$OPENISD_RUNTIME_DIR/post-land.lock.green" 2>/dev/null; }

# --- Test 1: two concurrent land.sh runs serialize on LAND_LOCK under $OPENISD_RUNTIME_DIR ---
setup_repo false
task w1 T1 a.txt; edit w1 a.txt one; git -C "$SCRATCH/w/w1" commit -qam "w1 change"
task w2 T2 b.txt; edit w2 b.txt two; git -C "$SCRATCH/w/w2" commit -qam "w2 change"

# Start both landings concurrently
cd "$SCRATCH"
land w1 T1 & p1=$!
land w2 T2 & p2=$!

# Wait for both to complete
wait $p1; r1=$?
wait $p2; r2=$?

# Capture origin log once to avoid timing races
origin_log=$(git -C "$SCRATCH/w/origin.git" log --format=%s main)

# Verify both succeeded
if [ $r1 = 0 ] && [ $r2 = 0 ] && echo "$origin_log" | grep -qF "T1: " && echo "$origin_log" | grep -qF "T2: "; then
    ok "two concurrent land.sh runs both land"
else
    fail "concurrent landings (r1=$r1 r2=$r2)"
fi

# Verify lock file exists under $OPENISD_RUNTIME_DIR (not /tmp)
if [ -f "$OPENISD_RUNTIME_DIR/land.lock" ]; then
    ok "LAND_LOCK exists at $OPENISD_RUNTIME_DIR/land.lock"
else
    fail "LAND_LOCK not found at $OPENISD_RUNTIME_DIR/land.lock"
fi

# Verify no legacy /tmp/openisd-* files exist
legacy_found=0
for f in /tmp/openisd-land.lock /tmp/openisd-post-land.lock /tmp/openisd-admit /tmp/openisd-heavy-gate-reservations /tmp/openisd-ui-test-reservations; do
    if [ -e "$f" ]; then
        echo "LEGACY PATH EXISTS: $f"
        legacy_found=1
    fi
done
if [ $legacy_found = 0 ]; then
    ok "no legacy /tmp/openisd-* paths created"
else
    fail "legacy /tmp/openisd-* paths found"
fi

# Verify linear history (no merge commits)
if git -C "$SCRATCH/w/origin.git" log --format=%P main | awk 'NF>1{exit 1}'; then
    ok "linear history (no merge commits)"
else
    fail "non-linear history (merge commit detected)"
fi

# Verify landing sections do not overlap (stub gate logs show serial execution)
landing_seq=$(tr '\n' ' ' < "$LANDING_LOG/seq" 2>/dev/null || echo "")
# Each landing runs: lint, typecheck, attribution x2 (two commits)
# Check: first landing's last event (2nd attribution_end) before second landing's first event (2nd lint_start)
first_landing_end_pos=$(echo "$landing_seq" | grep -b -o 'attribution_end' | sed -n '2p' | cut -d: -f1)
second_landing_start_pos=$(echo "$landing_seq" | grep -b -o 'lint_start' | sed -n '2p' | cut -d: -f1)
attribution_end_count=$(echo "$landing_seq" | grep -o 'attribution_end' | wc -l)
lint_start_count=$(echo "$landing_seq" | grep -o 'lint_start' | wc -l)
if [ "$attribution_end_count" -ge 2 ] && [ "$lint_start_count" -ge 2 ] && [ -n "$first_landing_end_pos" ] && [ -n "$second_landing_start_pos" ] && [ "$first_landing_end_pos" -lt "$second_landing_start_pos" ]; then
    ok "landing sections serialised, no overlap (seq=$landing_seq)"
else
    fail "landing sections overlapped (attribution_end_count=$attribution_end_count lint_start_count=$lint_start_count first_landing_end=$first_landing_end_pos second_landing_start=$second_landing_start_pos seq=$landing_seq)"
fi

# --- Test 2: two concurrent post-land runs serialize on POST_LAND_LOCK under $OPENISD_RUNTIME_DIR ---
setup_repo true
# Create two commits in the seed repo (which has origin remote)
cd "$SCRATCH/w/seed"
echo "commit one" >> a.txt; git add a.txt; git commit -qm "commit one"; git push -q origin main; s1=$(git rev-parse HEAD)
echo "commit two" >> b.txt; git add b.txt; git commit -qm "commit two"; git push -q origin main; s2=$(git rev-parse HEAD)

# Start the first post-land run, wait (blocking, bounded) until its suite signals on the fifo, then
# start the second so it contends for the lock while the first is inside the suite.
mkfifo "$SUITE_LOG/entered.fifo"
post "$s1" a & pp1=$!
timeout 10 cat "$SUITE_LOG/entered.fifo" > /dev/null || fail "post-land serialised: first run never entered the suite"
rm -f "$SUITE_LOG/entered.fifo"
post "$s2" b & pp2=$!
wait $pp1; rp1=$?
wait $pp2; rp2=$?
rm -f "$SUITE_LOG/entered.fifo"

# Verify both exit 0, seq shows no overlap (start end start end OR start end if coalesced), at least one run executed
seq=$(tr '\n' ' ' < "$SUITE_LOG/seq" 2>/dev/null || echo "")
runs_count=$(wc -l < "$SUITE_LOG/runs" 2>/dev/null || echo 0)
if [ $rp1 = 0 ] && [ $rp2 = 0 ] && { [ "$seq" = "start end start end " ] || [ "$seq" = "start end " ]; } && [ "$runs_count" -ge 1 ]; then
    ok "two concurrent post-land runs serialised, no overlap (seq=$seq runs=$runs_count green=$(green))"
else
    fail "concurrent post-land (rp1=$rp1 rp2=$rp2 seq=$seq runs=$runs_count green=$(green) s1=$s1 s2=$s2)"
fi

# Verify POST_LAND_LOCK exists under $OPENISD_RUNTIME_DIR
if [ -f "$OPENISD_RUNTIME_DIR/post-land.lock" ]; then
    ok "POST_LAND_LOCK exists at $OPENISD_RUNTIME_DIR/post-land.lock"
else
    fail "POST_LAND_LOCK not found at $OPENISD_RUNTIME_DIR/post-land.lock"
fi

# Verify no legacy /tmp/openisd-* files exist (again)
legacy_found=0
for f in /tmp/openisd-land.lock /tmp/openisd-post-land.lock /tmp/openisd-admit /tmp/openisd-heavy-gate-reservations /tmp/openisd-ui-test-reservations; do
    if [ -e "$f" ]; then
        echo "LEGACY PATH EXISTS: $f"
        legacy_found=1
    fi
done
if [ $legacy_found = 0 ]; then
    ok "no legacy /tmp/openisd-* paths created (post-land)"
else
    fail "legacy /tmp/openisd-* paths found (post-land)"
fi

# Verify clean copies removed
if ! grep -q . <(ls "$SCRATCH/copies" 2>/dev/null); then
    ok "post-land copies cleaned up"
else
    fail "post-land copies not cleaned up: $(ls "$SCRATCH/copies")"
fi

[ $fails = 0 ] && { echo "runtime-paths-concurrent.e2e: all passed"; exit 0; }
echo "runtime-paths-concurrent.e2e: $fails failed"; exit 1