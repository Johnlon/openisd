#!/usr/bin/env bash
# scripts/heavy.sh in a scratch setup (fake systemd-run, scratch ADMIT_DIR): a targeted run takes no
# slot and never waits behind a heavy job; a --slow run goes through scripts/admit.sh; both run in
# heavy.slice. Not one of the locked specs.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/heavy-test.XXXXXX")"
fails=0; pids=()
cleanup() { for p in "${pids[@]}"; do kill "$p" 2> /dev/null; done; wait 2> /dev/null; rm -rf "$SCRATCH"; }
trap cleanup EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

export ADMIT_DIR="$SCRATCH/admit" HEAVY_ADMIT="$REPO/scripts/admit.sh" FAKE_LOG="$SCRATCH/systemd-run.log"
HEAVY="$REPO/scripts/heavy.sh"
mkdir -p "$SCRATCH/bin"
cat > "$SCRATCH/bin/systemd-run" <<'FAKE'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_LOG"
while [ "$1" != "--" ]; do shift; done
shift
exec "$@"
FAKE
chmod +x "$SCRATCH/bin/systemd-run"
export PATH="$SCRATCH/bin:$PATH"

# 1. a targeted run, with the slot held by a heavy job, runs at once, in heavy.slice
bash "$HEAVY" --slow sleep 20 > "$SCRATCH/holder" 2>&1 & pids+=($!)
sleep 1
start=$SECONDS
timeout 10 bash "$HEAVY" echo targeted-ran > "$SCRATCH/t1" 2>&1; r=$?
if [ $r = 0 ] && grep -q targeted-ran "$SCRATCH/t1" && [ $((SECONDS - start)) -le 5 ] && grep -q -- '--slice=heavy.slice' "$FAKE_LOG"; then
    ok "targeted run did not wait behind a heavy job, ran in heavy.slice"; else fail "targeted (r=$r: $(tr '\n' ' ' < "$SCRATCH/t1"))"; fi

# 2. the targeted run took no slot: the queue holds only the heavy job
n=$(ls "$ADMIT_DIR/q" 2> /dev/null | wc -l)
[ "$n" = 1 ] && ok "targeted run took no slot (1 record: the heavy job)" || fail "slot records: $n"

# 3. a second heavy run waits behind the first, says so, and runs after it
timeout 60 bash "$HEAVY" --slow bash -c 'echo "token=${ADMIT_TOKEN:-none}"' > "$SCRATCH/h2" 2>&1 & w=$!; pids+=($w)
sleep 2
if ! kill -0 "$w" 2> /dev/null; then fail "second heavy run did not wait"
else
    kill "${pids[0]}" 2> /dev/null; wait "$w"; r=$?
    if [ $r = 0 ] && grep -q 'waiting for slot' "$SCRATCH/h2" && grep -q 'token=/' "$SCRATCH/h2"; then
        ok "heavy run waited for the slot, then ran with an ADMIT_TOKEN"; else fail "second heavy (r=$r: $(tr '\n' ' ' < "$SCRATCH/h2"))"; fi
fi

# 4. exit status passes through, for both kinds
bash "$HEAVY" bash -c 'exit 7' > /dev/null 2>&1; a=$?
bash "$HEAVY" --slow bash -c 'exit 9' > /dev/null 2>&1; b=$?
[ "$a $b" = "7 9" ] && ok "exit status passes through" || fail "exit statuses: $a $b"

# 5. --slow without admit.sh refuses, naming the path
HEAVY_ADMIT="$SCRATCH/none.sh" bash "$HEAVY" --slow true > "$SCRATCH/h5" 2>&1; r=$?
[ $r = 2 ] && grep -q "$SCRATCH/none.sh" "$SCRATCH/h5" && ok "--slow without admit.sh refuses and names it" || fail "no admit (r=$r)"

# 6. no command: usage, exit 2
bash "$HEAVY" > /dev/null 2>&1; r=$?
[ $r = 2 ] && ok "no command is a usage error" || fail "usage (r=$r)"

[ $fails = 0 ] && { echo "heavy: all passed"; exit 0; }
echo "heavy: $fails failed"; exit 1
